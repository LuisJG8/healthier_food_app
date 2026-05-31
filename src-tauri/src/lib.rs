use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;

const OPEN_FOOD_FACTS_FIELDS: &str = "code,product_name,product_name_en,generic_name,brands,categories,categories_tags,ingredients_text,ingredients_text_en,ingredients_tags,additives_tags,allergens_tags,labels_tags,nutriments,nova_group,nutriscore_grade,ecoscore_grade,image_front_url,image_url";
static OPEN_FOOD_FACTS_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[derive(Debug, Deserialize)]
struct OpenFoodFactsResponse {
    code: Option<Value>,
    status: Option<i64>,
    product: Option<OpenFoodFactsProduct>,
}

#[derive(Debug, Deserialize)]
struct OpenFoodFactsProduct {
    code: Option<Value>,
    product_name: Option<String>,
    product_name_en: Option<String>,
    generic_name: Option<String>,
    brands: Option<String>,
    categories: Option<String>,
    categories_tags: Option<Value>,
    ingredients_text: Option<String>,
    ingredients_text_en: Option<String>,
    ingredients_tags: Option<Value>,
    additives_tags: Option<Value>,
    allergens_tags: Option<Value>,
    labels_tags: Option<Value>,
    nutriments: Option<Value>,
    nova_group: Option<Value>,
    nutriscore_grade: Option<String>,
    ecoscore_grade: Option<String>,
    image_front_url: Option<String>,
    image_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProductDto {
    barcode: String,
    name: String,
    brand: Option<String>,
    categories: Vec<String>,
    categories_text: Option<String>,
    ingredients_text: Option<String>,
    ingredients_tags: Vec<String>,
    additives_tags: Vec<String>,
    allergens_tags: Vec<String>,
    labels_tags: Vec<String>,
    nutriments: Value,
    nova_group: Option<u8>,
    nutriscore_grade: Option<String>,
    ecoscore_grade: Option<String>,
    image_url: Option<String>,
    source: &'static str,
}

#[tauri::command]
async fn fetch_product_by_barcode(barcode: String) -> Result<ProductDto, String> {
    let normalized = validate_and_normalize_barcode(&barcode)?;

    let url = format!(
        "https://world.openfoodfacts.org/api/v2/product/{}.json?fields={}",
        urlencoding::encode(&normalized),
        urlencoding::encode(OPEN_FOOD_FACTS_FIELDS)
    );

    let response = open_food_facts_client()
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Could not reach Open Food Facts: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("Open Food Facts returned {}", response.status()));
    }

    let payload = response
        .json::<OpenFoodFactsResponse>()
        .await
        .map_err(|error| format!("Could not read Open Food Facts response: {error}"))?;

    normalize_response(payload, &normalized)
}

fn open_food_facts_client() -> &'static reqwest::Client {
    OPEN_FOOD_FACTS_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("BetterBite/0.1.0 (ingredient quality MVP; contact: local-dev)")
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Could not initialize HTTP client")
    })
}

fn normalize_response(
    payload: OpenFoodFactsResponse,
    fallback_barcode: &str,
) -> Result<ProductDto, String> {
    if payload.status == Some(0) {
        return Err("Product was not found in Open Food Facts.".to_string());
    }

    let product = payload
        .product
        .ok_or_else(|| "Product was not found in Open Food Facts.".to_string())?;

    Ok(normalize_product(product, payload.code, fallback_barcode))
}

fn normalize_product(
    product: OpenFoodFactsProduct,
    response_code: Option<Value>,
    fallback_barcode: &str,
) -> ProductDto {
    let product_code = product.code.as_ref().or(response_code.as_ref());
    let barcode = value_to_string(product_code).unwrap_or_else(|| fallback_barcode.to_string());
    let name = first_text([
        product.product_name.as_deref(),
        product.product_name_en.as_deref(),
        product.generic_name.as_deref(),
        Some("Unknown product"),
    ])
    .unwrap_or_else(|| "Unknown product".to_string());

    ProductDto {
        barcode,
        name,
        brand: empty_to_none(product.brands),
        categories: clean_tags(product.categories_tags),
        categories_text: empty_to_none(product.categories),
        ingredients_text: first_text([
            product.ingredients_text.as_deref(),
            product.ingredients_text_en.as_deref(),
        ]),
        ingredients_tags: clean_tags(product.ingredients_tags),
        additives_tags: clean_tags(product.additives_tags),
        allergens_tags: clean_tags(product.allergens_tags),
        labels_tags: clean_tags(product.labels_tags),
        nutriments: object_value_or_empty(product.nutriments),
        nova_group: parse_u8(product.nova_group.as_ref()),
        nutriscore_grade: empty_to_none(product.nutriscore_grade),
        ecoscore_grade: empty_to_none(product.ecoscore_grade),
        image_url: safe_image_url(product.image_front_url)
            .or_else(|| safe_image_url(product.image_url)),
        source: "open-food-facts",
    }
}

fn normalize_barcode(input: &str) -> String {
    input.chars().filter(char::is_ascii_digit).collect()
}

fn validate_and_normalize_barcode(input: &str) -> Result<String, String> {
    if input.trim().is_empty() {
        return Err("Enter a UPC or EAN barcode.".to_string());
    }

    if input.chars().any(|character| {
        !character.is_ascii_digit() && !character.is_ascii_whitespace() && character != '-'
    }) {
        return Err("Barcode can only contain numbers, spaces, or hyphens.".to_string());
    }

    let normalized = normalize_barcode(input);
    validate_barcode(&normalized)?;
    Ok(normalized)
}

fn validate_barcode(barcode: &str) -> Result<(), String> {
    match barcode.len() {
        8 | 12 | 13 => Ok(()),
        _ => Err("Use an 8, 12, or 13 digit UPC/EAN barcode.".to_string()),
    }
}

fn first_text<'a>(values: impl IntoIterator<Item = Option<&'a str>>) -> Option<String> {
    values
        .into_iter()
        .flatten()
        .map(str::trim)
        .find(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn empty_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn safe_image_url(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim();

        let url = reqwest::Url::parse(trimmed).ok()?;
        match (url.scheme(), url.host_str()) {
            ("https", Some("images.openfoodfacts.org" | "static.openfoodfacts.org")) => {
                Some(url.to_string())
            }
            _ => None,
        }
    })
}

fn clean_tags(tags: Option<Value>) -> Vec<String> {
    let mut cleaned = Vec::new();

    let Some(Value::Array(tags)) = tags else {
        return cleaned;
    };

    for tag in tags {
        let Some(tag) = tag.as_str() else {
            continue;
        };
        let without_locale = tag
            .split_once(':')
            .map(|(_, value)| value)
            .unwrap_or(tag)
            .replace('-', " ");
        let trimmed = without_locale.trim();

        if !trimmed.is_empty() && !cleaned.iter().any(|existing| existing == trimmed) {
            cleaned.push(trimmed.to_string());
        }
    }

    cleaned
}

fn object_value_or_empty(value: Option<Value>) -> Value {
    match value {
        Some(Value::Object(map)) => Value::Object(map),
        _ => Value::Object(Default::default()),
    }
}

fn parse_u8(value: Option<&Value>) -> Option<u8> {
    match value {
        Some(Value::Number(number)) => number.as_u64().and_then(|item| u8::try_from(item).ok()),
        Some(Value::String(text)) => text.parse::<u8>().ok(),
        _ => None,
    }
}

fn value_to_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) if !text.trim().is_empty() => Some(text.trim().to_string()),
        Some(Value::Number(number)) => Some(number.to_string()),
        _ => None,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(mobile)]
            {
                _app.handle().plugin(tauri_plugin_barcode_scanner::init())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![fetch_product_by_barcode])
        .run(tauri::generate_context!())
        .expect("error while running BetterBite");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_supported_barcode_lengths() {
        assert!(validate_barcode("12345678").is_ok());
        assert!(validate_barcode("123456789012").is_ok());
        assert!(validate_barcode("1234567890123").is_ok());
        assert!(validate_barcode("123").is_err());
    }

    #[test]
    fn validates_raw_barcode_input_before_normalizing() {
        assert_eq!(
            validate_and_normalize_barcode("5449-0000 00996").as_deref(),
            Ok("5449000000996")
        );
        assert_eq!(
            validate_and_normalize_barcode("abc12345678").unwrap_err(),
            "Barcode can only contain numbers, spaces, or hyphens."
        );
    }

    #[test]
    fn normalizes_open_food_facts_product() {
        let product = OpenFoodFactsProduct {
            code: Some(Value::String("123456789012".to_string())),
            product_name: Some("Test Chips".to_string()),
            product_name_en: None,
            generic_name: None,
            brands: Some(" BetterBite ".to_string()),
            categories: Some("Snacks, Chips".to_string()),
            categories_tags: Some(serde_json::json!(["en:snacks", "en:potato-chips"])),
            ingredients_text: Some("Potatoes, avocado oil, sea salt".to_string()),
            ingredients_text_en: None,
            ingredients_tags: None,
            additives_tags: Some(serde_json::json!([])),
            allergens_tags: None,
            labels_tags: Some(serde_json::json!(["en:organic"])),
            nutriments: None,
            nova_group: Some(Value::Number(serde_json::Number::from(3))),
            nutriscore_grade: Some("b".to_string()),
            ecoscore_grade: None,
            image_front_url: Some(
                "https://images.openfoodfacts.org/images/products/123/front.jpg".to_string(),
            ),
            image_url: None,
        };

        let normalized = normalize_product(product, None, "fallback");

        assert_eq!(normalized.barcode, "123456789012");
        assert_eq!(normalized.name, "Test Chips");
        assert_eq!(normalized.brand.as_deref(), Some("BetterBite"));
        assert_eq!(normalized.categories, vec!["snacks", "potato chips"]);
        assert_eq!(normalized.nova_group, Some(3));
        assert_eq!(
            normalized.image_url.as_deref(),
            Some("https://images.openfoodfacts.org/images/products/123/front.jpg")
        );
    }

    #[test]
    fn drops_untrusted_image_urls() {
        assert_eq!(
            safe_image_url(Some(
                "https://images.openfoodfacts.org.evil.test/front.jpg".to_string()
            )),
            None
        );
        assert_eq!(
            safe_image_url(Some("javascript:alert(1)".to_string())),
            None
        );
        assert_eq!(
            safe_image_url(Some(
                "https://images.openfoodfacts.org@evil.test/front.jpg".to_string()
            )),
            None
        );
    }

    #[test]
    fn normalizes_malformed_optional_fields() {
        let product = OpenFoodFactsProduct {
            code: Some(Value::String("12345678".to_string())),
            product_name: Some("Malformed product".to_string()),
            product_name_en: None,
            generic_name: None,
            brands: None,
            categories: None,
            categories_tags: Some(Value::String("en:snacks".to_string())),
            ingredients_text: None,
            ingredients_text_en: None,
            ingredients_tags: Some(serde_json::json!([42, "en:apple"])),
            additives_tags: Some(Value::Null),
            allergens_tags: None,
            labels_tags: Some(serde_json::json!(["en:organic", false])),
            nutriments: Some(serde_json::json!(["not", "an", "object"])),
            nova_group: None,
            nutriscore_grade: None,
            ecoscore_grade: None,
            image_front_url: None,
            image_url: None,
        };

        let normalized = normalize_product(product, None, "fallback");

        assert!(normalized.categories.is_empty());
        assert_eq!(normalized.ingredients_tags, vec!["apple"]);
        assert!(normalized.additives_tags.is_empty());
        assert_eq!(normalized.labels_tags, vec!["organic"]);
        assert_eq!(normalized.nutriments, Value::Object(Default::default()));
    }
}
