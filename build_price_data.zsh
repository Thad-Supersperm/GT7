#!/bin/zsh

# Use zsh's associative arrays
typeset -A used_prices
typeset -A legend_prices
typeset -A all_car_ids

# --- Data Ingestion ---
# Process 'used' directory
for file in data/used/*.csv; do
  date_key=$(basename "$file" .csv)
  awk -F, 'NR > 1 {id=$1; price=$2; gsub(/,/, "", price); print id"|"price}' "$file" | while IFS="|" read -r id price; do
    used_prices["$id,$date_key"]=$price
    all_car_ids[$id]=1
  done
done

# Process 'legend' directory
for file in data/legend/*.csv; do
  date_key=$(basename "$file" .csv)
  awk -F, 'NR > 1 {id=$1; price=$2; gsub(/,/, "", price); print id"|"price}' "$file" | while IFS="|" read -r id price; do
    legend_prices["$id,$date_key"]=$price
    all_car_ids[$id]=1
  done
done

# --- Data Processing ---
# Get a unique, sorted list of all dates (newest first)
all_dates=($( (ls data/used/*.csv; ls data/legend/*.csv) | xargs -n 1 basename | sed 's/\.csv//' | sort -u -r ))

# --- JSON Output Generation ---
echo "{"

first_car=true
for id in ${(k)all_car_ids}; do
  # Add a comma before each car object except the first one
  [[ $first_car == false ]] && echo ","
  first_car=false

  echo -n "  \"$id\": ["

  # --- Cell Merging Logic ---
  current_used=""
  current_legend=""
  colspan=0
  first_cell=true

  for date in $all_dates; do
    price_used=${used_prices["$id,$date"]:-""}
    price_legend=${legend_prices["$id,$date"]:-""}

    if [[ "$price_used" == "$current_used" && "$price_legend" == "$current_legend" ]]; then
      ((colspan++))
    else
      # Print the previous cell block if it exists
      if (( colspan > 0 )); then
        [[ $first_cell == false ]] && echo -n ","
        first_cell=false
        echo -n "{\"used\":\"$current_used\", \"legend\":\"$current_legend\", \"colspan\":$colspan}"
      fi
      current_used="$price_used"
      current_legend="$price_legend"
      colspan=1
    fi
  done

  # Print the final remaining cell block
  if (( colspan > 0 )); then
    [[ $first_cell == false ]] && echo -n ","
    echo -n "{\"used\":\"$current_used\", \"legend\":\"$current_legend\", \"colspan\":$colspan}"
  fi

  echo -n "  ]"
done

echo ""
echo "}"
