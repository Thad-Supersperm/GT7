#!/bin/zsh

typeset -A prices

# --- Data Ingestion ---
file_list=()
[[ -d data/used ]] && file_list+=(data/used/*.csv(N))
[[ -d data/legend ]] && file_list+=(data/legend/*.csv(N))

for file in $file_list; do
  type=$(echo "$file" | cut -d'/' -f2)
  date_key=$(basename "$file" .csv)
  
  # The only change is here: we are no longer pre-quoting the key in awk
  awk -v type="$type" -F, '
    NR > 1 {id=$1; price=$2; gsub(/,/, "", price); print id","date","type"|"price}
  ' date="$date_key" "$file" | while IFS="|" read -r key price; do
    # The key is now simple: 1001,22-03-04,used
    prices[$key]=$price
  done
done

# --- JSON Output Generation ---
echo "{"
keys=("${(@k)prices}")
num_keys=${#keys}
for ((i = 1; i < num_keys; i++)); do
  key=${keys[i]}
  # Now we add quotes around the key here, to make it a valid JSON key
  echo "  \"$key\": \"${prices[$key]}\","
done
if (( num_keys > 0 )); then
  key=${keys[num_keys]}
  echo "  \"$key\": \"${prices[$key]}\""
fi
echo "}"
