#!/bin/zsh

# Use zsh's associative arrays
typeset -A prices

# --- Data Ingestion ---
# Process both directories and build a single price map
for file in data/{used,legend}/*.csv; do
  # Determine if it's a used or legend file
  type=$(echo "$file" | cut -d'/' -f2)
  date_key=$(basename "$file" .csv)
  
  # Use awk to parse the correct price column (price or cr)
  awk -v type="$type" -F, '
    NR > 1 {
      id = $1
      price = $2
      gsub(/,/, "", price) # Remove commas from price
      # Print in a machine-readable format: ID|DATE|TYPE|PRICE
      print id"|"date"|"type"|"price
    }
  ' date="$date_key" "$file" | while IFS="|" read -r id date type price; do
    # Store prices like: prices["ID,DATE,TYPE"]=PRICE
    prices["$id,$date,$type"]=$price
  done
done

# --- JSON Output Generation ---
# Output a simple object: { "carID,date,type": "price", ... }
echo "{"
first_entry=true
for key in ${(k)prices}; do
  [[ $first_entry == false ]] && echo -n ","
  first_entry=false
  echo -n "  \"$key\": \"${prices[$key]}\""
done
echo ""
echo "}"
