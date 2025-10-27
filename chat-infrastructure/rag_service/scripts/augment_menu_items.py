from __future__ import annotations

import argparse
import json
from pathlib import Path


ENRICHMENTS = {
    "609b8c76-4c9c-4b12-982b-23bac0973d23": {
        "spice_level": "mild",
        "key_ingredients": ["lobster", "cream", "lobster stock", "cognac", "fresh herbs"],
        "allergens": ["shellfish", "dairy"],
        "dietary_tags": ["contains-shellfish", "contains-alcohol"],
        "contains_alcohol": True,
        "notes": "Traditional bisque finished with a splash of cognac; rich and creamy."
    },
    "abcee9b5-711c-4d7c-9c11-2058826ad000": {
        "spice_level": "mild",
        "key_ingredients": ["romaine lettuce", "parmesan", "garlic croutons", "anchovy dressing"],
        "allergens": ["dairy", "gluten", "fish", "egg"],
        "dietary_tags": ["contains-fish"],
        "contains_alcohol": False,
        "notes": "Anchovy-forward dressing; not vegetarian."
    },
    "f5c44048-16e1-406a-842f-39e32924dd9d": {
        "spice_level": "mild",
        "key_ingredients": ["arugula", "pear", "candied walnuts", "gorgonzola", "balsamic"],
        "allergens": ["tree-nut", "dairy"],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False
    },
    "5cda6132-3249-4bd2-a833-94c985bd48df": {
        "spice_level": "none",
        "key_ingredients": ["pinot grigio", "grapes"],
        "allergens": ["sulfites"],
        "dietary_tags": ["alcoholic-beverage", "gluten-free"],
        "contains_alcohol": True
    },
    "b3162052-10a4-4a0f-a964-81fee15bf395": {
        "spice_level": "none",
        "key_ingredients": ["gin", "campari", "sweet vermouth", "orange peel"],
        "allergens": [],
        "dietary_tags": ["alcoholic-beverage"],
        "contains_alcohol": True,
        "notes": "Balanced bitter cocktail with noticeable alcohol heat."
    },
    "d763a8aa-56b6-4506-b3bc-a407fe2551cf": {
        "spice_level": "none",
        "key_ingredients": ["sangiovese grapes"],
        "allergens": ["sulfites"],
        "dietary_tags": ["alcoholic-beverage"],
        "contains_alcohol": True
    },
    "0179135e-fcf0-4245-b16a-dd4625c2121d": {
        "spice_level": "mild",
        "key_ingredients": ["tomatoes", "basil", "mushroom ragù", "goat cheese", "baguette"],
        "allergens": ["gluten", "dairy"],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False
    },
    "27c0cc41-532a-4c41-afab-f73f5331e139": {
        "spice_level": "mild",
        "key_ingredients": ["squid", "semolina batter", "marinara", "aioli"],
        "allergens": ["shellfish", "gluten", "egg"],
        "dietary_tags": ["contains-shellfish"],
        "contains_alcohol": False
    },
    "bf68d98e-c2db-4458-b7a1-a2b9520c7373": {
        "spice_level": "none",
        "key_ingredients": ["burrata", "heirloom tomatoes", "basil", "balsamic glaze"],
        "allergens": ["dairy"],
        "dietary_tags": ["vegetarian", "gluten-free"],
        "contains_alcohol": False
    },
    "7f10fc4b-1749-4708-85de-ee4edba3935d": {
        "spice_level": "none",
        "key_ingredients": ["fresh orange juice"],
        "allergens": [],
        "dietary_tags": ["vegan", "gluten-free"],
        "contains_alcohol": False
    },
    "34e3cb6e-c84d-45c9-88d7-2b35361f8e0f": {
        "spice_level": "none",
        "key_ingredients": ["syrup", "sparkling water", "cream (optional)"],
        "allergens": [],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False,
        "notes": "Contains added sugar; optional cream topping adds dairy."
    },
    "23658853-2f72-4f47-ab66-f98a22ba423e": {
        "spice_level": "none",
        "key_ingredients": ["arabica espresso"],
        "allergens": [],
        "dietary_tags": ["vegan", "gluten-free"],
        "contains_alcohol": False,
        "notes": "Contains caffeine."
    },
    "c802955c-1f30-48ad-8236-35b86587a99d": {
        "spice_level": "mild",
        "key_ingredients": ["pizza dough", "prosciutto di parma", "mozzarella", "arugula", "parmesan"],
        "allergens": ["gluten", "dairy"],
        "dietary_tags": ["contains-pork"],
        "contains_alcohol": False
    },
    "5b511bda-415f-45c0-95ec-92b9ce0037df": {
        "spice_level": "mild",
        "key_ingredients": ["pizza dough", "san marzano tomatoes", "mozzarella", "basil"],
        "allergens": ["gluten", "dairy"],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False
    },
    "e7de65ae-b8aa-4086-81e3-093caa8e0963": {
        "spice_level": "mild",
        "key_ingredients": ["pizza dough", "artichokes", "mushrooms", "prosciutto", "olives"],
        "allergens": ["gluten", "dairy"],
        "dietary_tags": ["contains-pork"],
        "contains_alcohol": False
    },
    "6b4a65eb-18e8-43ce-b830-358a19988eb3": {
        "spice_level": "mild",
        "key_ingredients": ["lobster", "ricotta", "pasta dough", "cream tomato sauce"],
        "allergens": ["shellfish", "gluten", "dairy", "egg"],
        "dietary_tags": ["contains-shellfish"],
        "contains_alcohol": False
    },
    "6259f7aa-328c-41fb-beb2-253cd23636aa": {
        "spice_level": "mild",
        "key_ingredients": ["arborio rice", "black truffle", "parmesan", "mushrooms"],
        "allergens": ["dairy"],
        "dietary_tags": ["vegetarian", "gluten-free"],
        "contains_alcohol": False
    },
    "b152b63f-d539-49c0-b193-b2b78c336685": {
        "spice_level": "mild",
        "key_ingredients": ["spaghetti", "pancetta", "egg yolk", "pecorino romano", "black pepper"],
        "allergens": ["gluten", "dairy", "egg"],
        "dietary_tags": ["contains-pork"],
        "contains_alcohol": False
    },
    "87c08a7c-067c-40d7-9517-06e9c5959d32": {
        "spice_level": "mild",
        "key_ingredients": ["pasta", "marinara", "fresh mozzarella", "basil"],
        "allergens": ["gluten", "dairy"],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False
    },
    "9fbbe9b3-5ccb-431a-a20f-72cacac77ad4": {
        "spice_level": "none",
        "key_ingredients": ["ladyfingers", "espresso", "mascarpone", "cocoa"],
        "allergens": ["dairy", "gluten", "egg"],
        "dietary_tags": [],
        "contains_alcohol": True,
        "notes": "Traditional recipe is brushed with coffee liqueur."
    },
    "c759efb3-b83b-47e6-b6c0-7fb068d0624a": {
        "spice_level": "none",
        "key_ingredients": ["vanilla custard", "cream", "egg yolk", "caramelized sugar"],
        "allergens": ["dairy", "egg"],
        "dietary_tags": ["gluten-free"],
        "contains_alcohol": False
    },
    "d1db3fe0-d25b-4153-a2c3-21c1cc2fdcdc": {
        "spice_level": "none",
        "key_ingredients": ["dark chocolate", "butter", "flour", "eggs", "vanilla ice cream"],
        "allergens": ["dairy", "gluten", "egg"],
        "dietary_tags": [],
        "contains_alcohol": False
    },
    "1d0e835a-d24d-472b-86f7-d5d0d89a16e6": {
        "spice_level": "mild",
        "key_ingredients": ["chicken breast", "marsala wine", "mushrooms", "butter"],
        "allergens": ["dairy"],
        "dietary_tags": [],
        "contains_alcohol": True
    },
    "4ea870cd-a5e4-48f6-97ea-d87fe36e1164": {
        "spice_level": "mild",
        "key_ingredients": ["lamb rack", "herb crust", "rosemary jus", "seasonal vegetables"],
        "allergens": ["dairy"],
        "dietary_tags": [],
        "contains_alcohol": True,
        "notes": "Jus is finished with red wine."
    },
    "e69547d9-5f05-4f8d-830e-986c4b6316d9": {
        "spice_level": "mild",
        "key_ingredients": ["atlantic salmon", "lemon herb butter", "roasted vegetables", "wild rice"],
        "allergens": ["fish", "dairy"],
        "dietary_tags": ["gluten-free"],
        "contains_alcohol": False
    },
    "f2ac373e-61e3-4d5e-b556-9f2dfeb592ee": {
        "spice_level": "mild",
        "key_ingredients": ["beef tenderloin", "red wine reduction", "garlic mashed potatoes"],
        "allergens": ["dairy", "sulfites"],
        "dietary_tags": [],
        "contains_alcohol": True
    },
    "b7b6073b-d886-4ca3-856d-9b7357edb1a6": {
        "spice_level": "none",
        "key_ingredients": ["tri-color quinoa", "roasted squash", "cranberries", "toasted pepitas", "citrus vinaigrette"],
        "allergens": [],
        "dietary_tags": ["vegan", "gluten-free"],
        "contains_alcohol": False,
        "notes": "Pepitas are pumpkin seeds; suitable for most nut-free guests."
    },
    "dc289bdb-6d3e-46a6-a4b8-bb0b90ef9745": {
        "spice_level": "none",
        "key_ingredients": ["fire-roasted tomatoes", "basil cream", "vegetable stock", "grilled sourdough"],
        "allergens": ["dairy", "gluten"],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False
    },
    "7b4d8e26-c941-411f-b02d-4af26315d5dc": {
        "spice_level": "none",
        "key_ingredients": ["vodka", "fresh espresso", "coffee liqueur", "vanilla syrup"],
        "allergens": [],
        "dietary_tags": ["alcoholic-beverage"],
        "contains_alcohol": True,
        "notes": "High caffeine cocktail; shaken to a silky foam."
    },
    "afe68abc-405b-4a1b-bde9-d9f1f92457cb": {
        "spice_level": "none",
        "key_ingredients": ["aperol", "prosecco", "soda water", "orange"],
        "allergens": ["sulfites"],
        "dietary_tags": ["alcoholic-beverage", "gluten-free"],
        "contains_alcohol": True
    },
    "21a15ef4-192a-48ea-84b9-b562aff2bd50": {
        "spice_level": "none",
        "key_ingredients": ["cured meats", "aged cheeses", "fig jam", "grilled focaccia"],
        "allergens": ["dairy", "gluten"],
        "dietary_tags": ["contains-pork"],
        "contains_alcohol": False,
        "notes": "Board composition can vary; request details for nut allergies."
    },
    "898f1b89-bef7-4385-a53d-947eb831da6f": {
        "spice_level": "none",
        "key_ingredients": ["portobello mushroom", "ricotta", "spinach", "pine nuts"],
        "allergens": ["dairy", "tree-nut"],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False
    },
    "5cbada32-c16f-4512-b9b5-adce94574d21": {
        "spice_level": "none",
        "key_ingredients": ["cold brew concentrate", "citrus tonic", "grapefruit peel"],
        "allergens": [],
        "dietary_tags": ["vegan", "gluten-free"],
        "contains_alcohol": False,
        "notes": "Highly caffeinated sparkling coffee."
    },
    "cc7355c7-f96e-457c-8892-829d546db321": {
        "spice_level": "none",
        "key_ingredients": ["ceremonial matcha", "oat milk", "wildflower honey"],
        "allergens": [],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False,
        "notes": "Contains honey; not vegan. Oat milk may contain trace gluten."
    },
    "d56850ed-12d2-4ef9-a405-8c4e208267c0": {
        "spice_level": "none",
        "key_ingredients": ["yuzu puree", "mint", "sparkling water", "agave"],
        "allergens": [],
        "dietary_tags": ["vegan", "gluten-free"],
        "contains_alcohol": False
    },
    "3fe9fb15-9593-48a7-9b6c-500c291c63aa": {
        "spice_level": "mild",
        "key_ingredients": ["pizza dough", "wild mushrooms", "taleggio", "arugula", "truffle oil"],
        "allergens": ["gluten", "dairy"],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False
    },
    "f0ca9409-d2de-4de5-bf92-750905336f6d": {
        "spice_level": "medium",
        "key_ingredients": ["pizza dough", "spicy soppressata", "mozzarella", "chili oil", "charred peppers"],
        "allergens": ["gluten", "dairy"],
        "dietary_tags": ["contains-pork"],
        "contains_alcohol": False
    },
    "8e200af8-82f5-444b-ae98-649bab9c78b9": {
        "spice_level": "mild",
        "key_ingredients": ["linguine", "shrimp", "mussels", "calamari", "roasted garlic tomato broth"],
        "allergens": ["shellfish", "gluten"],
        "dietary_tags": ["contains-shellfish"],
        "contains_alcohol": False
    },
    "0dad679c-87e2-4621-8fbe-c6d270b9e09e": {
        "spice_level": "none",
        "key_ingredients": ["house gelato", "almond tuile", "seasonal fruit"],
        "allergens": ["dairy", "tree-nut"],
        "dietary_tags": [],
        "contains_alcohol": False
    },
    "e257cc26-7828-495a-b6ec-05c6f3c834f9": {
        "spice_level": "none",
        "key_ingredients": ["cannoli shells", "ricotta", "pistachios", "candied orange peel"],
        "allergens": ["dairy", "gluten", "tree-nut"],
        "dietary_tags": [],
        "contains_alcohol": False
    },
    "444df689-0832-4134-96e4-5f03945586f5": {
        "spice_level": "mild",
        "key_ingredients": ["beef short ribs", "red wine braise", "parmesan polenta", "roasted carrots"],
        "allergens": ["dairy", "sulfites"],
        "dietary_tags": [],
        "contains_alcohol": True
    },
    "9cd431c3-48be-459a-a325-574dad59174c": {
        "spice_level": "none",
        "key_ingredients": ["day-boat scallops", "saffron risotto", "asparagus", "citrus beurre blanc"],
        "allergens": ["shellfish", "dairy"],
        "dietary_tags": [],
        "contains_alcohol": False
    },
    "af477545-a928-47da-9ce9-dc258198fce3": {
        "spice_level": "mild",
        "key_ingredients": ["breaded eggplant", "basil marinara", "mozzarella", "ricotta"],
        "allergens": ["gluten", "dairy"],
        "dietary_tags": ["vegetarian"],
        "contains_alcohol": False
    }
}


def enrich_items(input_path: Path, output_path: Path) -> None:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    for item in data.get("items", []):
        extra = ENRICHMENTS.get(item["menu_item_id"])
        if not extra:
            continue
        item.update(extra)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Enriched {len(ENRICHMENTS)} menu items → {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Augment exported menu items with tags and allergen metadata.")
    parser.add_argument("--input", required=True, help="Path to menu_items.json")
    parser.add_argument("--output", required=True, help="Path to write enriched JSON")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    enrich_items(input_path, output_path)


if __name__ == "__main__":
    main()
