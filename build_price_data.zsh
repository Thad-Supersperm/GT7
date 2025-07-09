#!/bin/zsh

typeset -A prices

# --- Data Ingestion ---
# Use a safer way to find files that doesn't fail if a directory is empty
file_list=()
[[ -d data/used ]] && file_list+=(data/used/*.csv)
[[ -d data/legend ]] && file_list+=(data/legend/*.csv)

for file in $file_list; do
  [[ ! -f "$file" ]] && continue # Skip if the glob pattern returned itself
  
  type=$(echo "$file" | cut -d'/' -f2)
  date_key=$(basename "$file" .csv)
  
  awk -v type="$type" -F, '
    NR > 1 {
      id = $1
      price = $2
      gsub(/,/, "", price)
      print id"|"date"|"type"|"price
    }
  ' date="$date_key" "$file" | while IFS="|" read -r id date type price; do
    prices["$id,$date,$type"]=$price
  done
done

# --- JSON Output Generation ---
echo "{"
first_entry=true
for key in ${(k)prices}; do
  [[ $first_entry == false ]] && echo -n ","
  first_entry=false
  # Ensure the value is properly quoted in JSON
  echo -n "  \"$key\": \"${prices[$key]}\""
done
echo ""
echo "}"
