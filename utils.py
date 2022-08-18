import json
import os


def consolidate_anime_info():
    """Consolidate anime info files into a single master JSON file"""
    anime_info = {}
    num = 0
    dir = "public/data/anime-info"
    for fname in os.listdir(dir):
        id, ext = os.path.splitext(fname)
        if ext != ".json":
            continue
        if id == "consolidated":
            continue

        path = os.path.join(dir, fname)
        with open(path) as fp:
            contents = json.load(fp)
            anime_info[id] = contents
            num += 1

    print(f"read {num} files")

    with open("public/data/anime-info/consolidated.json", "w") as fp:
        json.dump(anime_info, fp, indent=4, sort_keys=True)

    print("consolidation complete")

if __name__ == "__main__":
    consolidate_anime_info()
