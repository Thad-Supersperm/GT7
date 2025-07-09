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
    # We will now pre-quote the key in awk to make it a valid JSON string key
    NR > 1 {id=$1; price=$2; gsub(/,/, "", price); print "\""id","date","type"\"|"price}
  ' date="$date_key" "$file" | while IFS="|" read -r key price; do
    # The key is now already quoted, e.g., "car1,22-03-04,used"
    prices[$key]=$price
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
  # THE FIX IS HERE: We print the key directly because it's already quoted.
  # We only add quotes around the value.
  echo "  $key: \"${prices[$key]}\","
done

# Print the very last key-value pair WITHOUT a comma
if (( num_keys > 0 )); then
  key=${keys[num_keys]}
  echo "  $key: \"${prices[$key]}\""
fi

echo "}"
