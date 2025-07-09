#!/bin/zsh

typeset -A prices

# --- Data Ingestion (Safe version) ---
file_list=()
[[ -d data/used ]] && file_list+=(data/used/*.csv)
[[ -d data/legend ]] && file_list+=(data/legend/*.csv)

for file in $file_list; do
  [[ ! -f "$file" ]] && continue
  
  type=$(echo "$file" | cut -d'/' -f2)
  date_key=$(basename "$file" .csv)
  
  awk -v type="$type" -F, '
    NR > 1 {id=$1; price=$2; gsub(/,/, "", price); print id"|"date"|"type"|"price}
  ' date="$date_key" "$file" | while IFS="|" read -r id date type price; do
    prices["$id,$date,$type"]=$price
  done
done

# --- JSON Output Generation (NEW ROBUST LOGIC) ---
# This new logic prevents trailing commas.
output_lines=()
for key in ${(k)prices}; do
  # Create each "key": "value" line
  output_lines+=( "  \"$key\": \"${prices[$key]}\"" )
done

# Join all the lines with a comma and a newline
joined_output=$(IFS=$',\n'; echo "${output_lines[*]}")

# Print the final, valid JSON object
echo "{\n$joined_output\n}"
