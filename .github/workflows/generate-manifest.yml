import os
import json

# Define paths
used_path = 'data/used/'
legend_path = 'data/legend/'
output_file = 'data/manifest.json' # Moved to a central location

manifest_data = {
    "used": [],
    "legend": []
}

# Process 'used' directory
try:
    used_files = [f for f in os.listdir(used_path) if f.endswith('.csv')]
    used_files.sort(reverse=True)
    manifest_data["used"] = used_files
    print(f"Found {len(used_files)} files in {used_path}")
except FileNotFoundError:
    print(f"Warning: Directory '{used_path}' not found. Skipping.")

# Process 'legend' directory
try:
    legend_files = [f for f in os.listdir(legend_path) if f.endswith('.csv')]
    legend_files.sort(reverse=True)
    manifest_data["legend"] = legend_files
    print(f"Found {len(legend_files)} files in {legend_path}")
except FileNotFoundError:
    print(f"Warning: Directory '{legend_path}' not found. Skipping.")

# Create the parent directory for the output file if it doesn't exist
os.makedirs(os.path.dirname(output_file), exist_ok=True)

# Write the combined manifest
with open(output_file, 'w') as f:
    json.dump(manifest_data, f)

print(f"Successfully created/updated manifest at '{output_file}'")
