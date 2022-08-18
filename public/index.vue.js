// global Vue

const { createApp } = Vue;

function loadLocalStorageJSON(key) {
    const v = localStorage.getItem(key);
    if (v) {
        return JSON.parse(v);
    } else {
        return null;
    }
}

/**
 * @param {{[key: any]: number}} counterDict
 * @param {number} n How many items to return
 * @returns {[any]} Highest value keys in the dictionary in descending order
 */
function mostCommon(counterDict, n) {
    const l = Object.keys(counterDict);
    // sort descending
    l.sort((a, b) => {
        return counterDict[b] - counterDict[a];
    });
    return l.slice(0, n);
}

createApp({
    data() {
        return {
            /**
             * @property {string}
             */
            username: localStorage.getItem('username') || '',

            // null before fetched
            /**
             * A user's anime list
             * Structure:
             *      - data: array of anime objects
             *          - each element looks like:
             *              - node -> info about the anime
             *              - list_status -> info the user entered such as num_episodes_watched and status
             *      - paging: pagination info
             * @property {{
             *      data: [any],
             *      paging: any
             * } | null}
             */
            animeList: loadLocalStorageJSON('animeList') || null,

            /**
             * @property {string|null}
             */
            fetchError: null,

            /**
             * Database of all anime on MAL where possible
             * Structure:
             *      - map from anime ID to an entry
             *          - each entry has fieldds like id, mean, num_episodes, ...
             * @property {[any] | null}
             */
            animeInfo: loadLocalStorageJSON('animeInfo') || null,

            /**
             * @property {string | null}
             */
            selectedGenre: null,
        }
    },
    methods: {
        computeTopGenres() {
            // once we have the anime list we can compute the genres
            // for ()
        },

        // only works over animeInfo
        countGenres(animeInfoEntry, genreCounts) {
            if (!animeInfoEntry) {
                throw new Error('animeInfoEntry is undefined');
            }

            if (!genreCounts) {
                // can pass a dictionary to update as param
                genreCounts = {};
            }
            for(let genre of animeInfoEntry.genres) {
                const genreName = genre.name;
                if (!(genreName in genreCounts)) {
                    genreCounts[genreName] = 0;
                }
                genreCounts[genreName]++;
            }
            return genreCounts;
        },

        async fetchAnimeList(username) {
            // TODO
            const r = await fetch(`data/other-peoples-lists/${username}.json`, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (r.ok) {
                const j = await r.json();
                // pre-filter
                j.data = j.data.filter((entry) => {
                    // I have rated this anime
                    return entry.list_status.score > 0;
                });
                this.animeList = j;
                this.fetchError = null;
                console.log('anime list fetched');

                // compute the top genres
                this.computeTopGenres();
            } else {
                this.fetchError = `username ${username} not found`;
                this.animeList = null;
            }
        },

        async fetchAllAnime() {
            const r = await fetch('/data/anime-info/consolidated.json', {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (r.ok) {
                const j = await r.json();
                this.animeInfo = j;
            }
        },

        handleSubmit(e) {
            e.preventDefault();
            console.log(this.username)

            this.fetchAnimeList(this.username);

            return false;
        },

        getAnimeWithGenre(genre, animeList, animeInfo) {
            if (!genre || !animeList || !animeInfo) {
                throw new Error('missing required params');
            }
            return animeList.data.filter((entry) => {
                const id = entry.node.id;
                if (!(id in animeInfo)) {
                    console.log(`ignoring anime with ID ${id} during filtering`);
                    return false;
                }
                const genreNames = animeInfo[id].genres.map(g => g.name);
                return genreNames.includes(genre);
            }).map((entry) => {
                const id = entry.node.id;
                const title = entry.node.title;
                const enTitle = animeInfo[id].alternative_titles.en;
                const t = (enTitle && enTitle !== title) ? `${title} / ${enTitle}`: title;
                return entry;
            });
        },
    },

    created() {
        console.log('created');
        this.fetchAllAnime();
    },

    watch: {
        username: {
            handler() {
                // update localStorage
                window.localStorage.setItem('username', this.username);
            }
        },
        animeInfo: {
            handler() {
                // update localStorage
                window.localStorage.setItem('animeInfo', JSON.stringify(this.animeInfo));
            }
        },
        animeList: {
            handler() {
                // update localStorage
                window.localStorage.setItem('animeList', JSON.stringify(this.animeList));
            }
        }
    },

    computed: {
        animeInfoGenreCounts() {
            const genreCounts = {};
            for(let [id, animeInfoEntry] of Object.entries(this.animeInfo)) {
                this.countGenres(animeInfoEntry, genreCounts);
            }
            return genreCounts;
        },

        animeListGenreCounts() {
            if (!this.animeList) {
                return null;
            }

            if (!this.animeInfo) {
                return null;
            }

            const genreCounts = {};
            for (let anime of this.animeList.data) {
                const id = anime.node.id;
                if (!(id in this.animeInfo)) {
                    // TODO
                    console.error(`no entry for anime with id ${id}`);
                    continue;
                }

                const animeInfoEntry = this.animeInfo[id];
                this.countGenres(animeInfoEntry, genreCounts);
            }
            return genreCounts;
        },
        topAnimeInfoGenres() {
            return mostCommon(this.animeInfoGenreCounts, 10);
        },
        topAnimeListGenres() {
            return mostCommon(this.animeListGenreCounts, 10);
        },

        favAnimeListGenres() {
            return mostCommon(this.userGenreScores, 10);
        },

        powerGenresV() {
            const powerGenres = {};
            Object.entries(this.animeListGenreCounts).forEach(([genre, myCount]) => {
                const totalCount = this.animeInfoGenreCounts[genre];
                powerGenres[genre] = myCount / (totalCount + 1);
            });
            return powerGenres;
        },

        powerGenres() {
            return mostCommon(this.powerGenresV, 10);
        },

        animeWithSelectedGenre() {
            if (!this.selectedGenre) {
                return [];
            }
            if (!this.animeList) {
                return [];
            }
            if (!this.animeInfo) {
                return [];
            }
            return this.animeList.data.filter((entry) => {
                const id = entry.node.id;
                if (!(id in this.animeInfo)) {
                    console.log(`ignoring anime with ID ${id} during filtering`);
                    return false;
                }
                const genreNames = this.animeInfo[id].genres.map(g => g.name);
                return genreNames.includes(this.selectedGenre);
            }).map((entry) => {
                const id = entry.node.id;
                const title = entry.node.title;
                const enTitle = this.animeInfo[id].alternative_titles.en;
                const t = (enTitle && enTitle !== title) ? `${title} / ${enTitle}`: title;
                return {
                    title: t,
                    id: id,
                    score: entry.list_status.score,
                };
            });
        },
        userGenreScores() {
            const genreScores = {};
            Object.keys(this.animeListGenreCounts).map((genre) => {
                // return a list of anime entries from this.animeList
                const l = this.getAnimeWithGenre(genre, this.animeList, this.animeInfo);
                let sum = 0;
                let count = 0;
                l.forEach((entry) => {
                    sum += entry.list_status.score;
                    count++;
                });
                genreScores[genre] = sum / count;
            });

            return genreScores;
        },
        globalGenreScores() {
            const genreScores = {};
            Object.keys(this.animeListGenreCounts).map((genre) => {
                // return a list of anime entries from this.animeList
                const l = this.getAnimeWithGenre(genre, this.animeList, this.animeInfo);
                let sum = 0;
                let count = 0;
                l.forEach((entry) => {
                    const globalEntry = this.animeInfo[entry.node.id];
                    sum += globalEntry.mean;
                    count++;
                });
                genreScores[genre] = sum / count;
            });

            return genreScores;
        },

        /**
         * Only rate those anime 
         * @returns {{[key: string]: any}} Map from anime ID to its predicted rating
         */
        predictedRatingsV() {
            const predictedRatings = {};
            if (!this.animeList) {
                return predictedRatings;
            }

            Object.values(this.animeInfo).forEach((globalEntry) => {
                let score = 0;
                let count = 0;
                // let globalEntry = this.animeInfo[entry.node.id];
                globalEntry.genres.forEach((genre) => {
                    const genreName = genre.name;
                    if(!(genreName in this.userGenreScores)) {
                        console.warn(`did not find genre ${genreName} in user genre scores`);
                    }
                    score += this.userGenreScores[genreName] || 0;
                    count++;
                });

                predictedRatings[globalEntry.id] = score / count;
            });
            return predictedRatings;
        },

        /**
         * @returns {[string]} Array of anime IDs with highest predicted ratings
         */
        topPredictedRatingsUnseen() {
            // array of IDs
            const seen = this.animeList.data.map(entry => {
                return entry.node.id;
            });
            // array of anime entries
            const unseen = Object.values(this.animeInfo).filter((globalEntry) => {
                return !seen.includes(globalEntry.id);
            });

            // don't recommend anime that's "not good"
            const goodUnseen = unseen.filter(globalEntry => globalEntry.mean >= 6.5);

            const ratingsGoodUnseen = {}
            goodUnseen.forEach((globalEntry) => {
                ratingsGoodUnseen[globalEntry.id] = this.predictedRatingsV[globalEntry.id];
            });
            return mostCommon(ratingsGoodUnseen, 10);
        },

        /**
         * @returns {[string]} Array of anime IDs
         */
        leastLikelyLikes() {
            if (!this.animeList) {
                throw new Error('anime list not defined');
            }
            const myPredictedRatings = {}
            this.animeList.data.forEach((entry) => {
                if (!(entry.node.id) in this.predictedRatingsV) {
                    throw new Error(`did not find any with ID ${entry.node.id} in predicted ratings`);
                }
                myPredictedRatings[entry.node.id] = {
                    predictedRating: this.predictedRatingsV[entry.node.id],
                    entry: entry,
                };
            });
            const l = Object.keys(myPredictedRatings);
            // sort with lowest first
            l.sort((id1, id2) => {
                return myPredictedRatings[id1].predictedRating - myPredictedRatings[id2].predictedRating;
            });
            return l.slice(0, 10).map((id) => {
                return myPredictedRatings[id].entry;
            });
        }
    },
}).mount('#vue-root');