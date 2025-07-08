import os
import json

used_data_path = 'data/used/'
output_file = os.path.join(used_data_path, 'manifest.json')

# Find all .csv files in the directory
try:
    filenames = [f for f in os.listdir(used_data_path) if f.endswith('.csv')]
    # Sort them in reverse chronological order (newest first)
    filenames.sort(reverse=True)

    with open(output_file, 'w') as f:
        json.dump(filenames, f)

    print(f"Successfully created/updated manifest.json with {len(filenames)} files.")

except FileNotFoundError:
    print(f"Error: Directory '{used_data_path}' not found.")
