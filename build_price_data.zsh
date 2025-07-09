#!/bin/zsh

typeset -A prices

# --- Data Ingestion (Safe version) ---
file_list=()
# Use (N) glob qualifier to prevent errors if directories are empty
[[ -d data/used ]] && file_list+=(data/used/*.csv(N))
[[ -d data/legend ]] && file_list+=(data/legend/*.csv(N))

for file in $file_list; do
  type=$(echo "$file" | cut -d'/' -f2)
  date_key=$(basename "$file" .csv)
  
  awk -v type="$type" -F, '
    NR > 1 {id=$1; price=$2; gsub(/,/, "", price); print id"|"date"|"type"|"price}
  ' date="$date_key" "$file" | while IFS="|" read -r id date type price; do
    prices["$id,$date,$type"]=$price
  done
done

# --- JSON Output Generation (FOOLPROOF LOOP) ---
echo "{"

# Get all the keys into an array
keys=("${(@k)prices}")
num_keys=${#keys}

# Loop through all keys except the last one, printing a comma
for ((i = 1; i < num_keys; i++)); do
  key=${keys[i]}
  echo "  \"$key\": \"${prices[$key]}\","
done

# Print the very last key-value pair WITHOUT a comma
if (( num_keys > 0 )); then
  key=${keys[num_keys]}
  echo "  \"$key\": \"${prices[$key]}\""
fi

echo "}"
