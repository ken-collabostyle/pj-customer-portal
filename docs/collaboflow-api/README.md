# コラボフローAPI リファレンス

コラボフロー（本体）が提供するREST APIのドキュメントです。フォーム化された対象7フォームのパーツ（JSON）構造取得に、以下の `getFormParts` エンドポイントを利用します。

- 公式ドキュメント（Swagger UI）: https://docs.collaboflow.com/api-docs/#/Form/getFormParts
- 元となるOpenAPI仕様: [openapi.yaml](openapi.yaml)（2026-08-21取得。全エンドポイント・全スキーマを含む完全なコピー）

コラボフォームのカスタマイズ（[../collaboform-js-api/](../collaboform-js-api/)）とは別の製品・APIなので混同しないよう注意してください。

## 認証

HTTPヘッダー `X-Collaboflow-Authorization` に認証情報を付与します（詳細は `openapi.yaml` の `info.description` 参照）。

- **パスワード認証**: `Basic` + 半角空白 + `ログインID:パスワード` をBASE64エンコード
- **APIキー認証**: `Basic` + 半角空白 + `ログインID/apikey:APIキー` をBASE64エンコード（APIキーは「システム管理＞環境設定」で発行。バッチ処理向け）

APIの実行は認証したユーザーの権限範囲内に制限されます。HTTPS通信が強く推奨されています。

## エンドポイント

- クラウド版: `https://{instance}.collaboflow.com/{instance}/api/index.cfm` 相当（`servers` 参照。実際のホスト名は契約環境に依存）

## `getFormParts`：フォームのパーツ一覧を取得

```
GET /v1/forms/{form_id}/versions/{form_version}/parts
```

設定権限が付与されたグループに所属するユーザー、またはシステム管理者ユーザーのみ取得可能です。

### パスパラメータ

| 名前 | 型 | 必須 | 説明 |
|---|---|---|---|
| `form_id` | integer | 必須 | フォームID |
| `form_version` | string | 必須 | フォームの版番号。`latest` 指定で最新バージョンを取得 |

### クエリパラメータ

| 名前 | 型 | 必須 | 説明 |
|---|---|---|---|
| `app_cd` | integer | 必須 | コラボフローアプリケーションのコード |
| `detail` | boolean | 任意（デフォルト `true`） | `false` の場合はパーツの名前と種類のみ取得。省略時（`true`）は詳細情報を含む |

### レスポンス（200）のトップレベル構造

| フィールド | 型 | 説明 |
|---|---|---|
| `total_count` | integer | 総パーツ数 |
| `version` | integer | フォームバージョン |
| `app_cd` | integer | コラボフローアプリケーションのコード |
| `error` | boolean | エラーの有無 |
| `parts` | object | パーツID（例: `fidText`）をキーとした、パーツ設定情報のマップ |

`parts` オブジェクトの各値は、パーツの `type` によってスキーマが異なります（下表）。取得したJSONを保存・参照する際は、`type` を見てどのスキーマに該当するかを判断してください。

### パーツタイプ別スキーマ

各スキーマの正式な全フィールド定義は [openapi.yaml](openapi.yaml) の `components.schemas` 配下にあります（スキーマ名で検索してください）。共通プロパティは `PartsSetting_Common`（`name` / `hint` / `comment` / `required`）で、各タイプはこれを継承し独自プロパティを追加します。

| `type` の値 | パーツ種別 | スキーマ名 |
|---|---|---|
| `text` | テキスト（一行） | `PartsSetting_Text` |
| `number` | テキスト（一行・数値型） | `PartsSetting_Number` |
| `money` | テキスト（一行・金額型） | `PartsSetting_Money` |
| `textarea` | テキストエリア | `PartsSetting_Textarea` |
| `date` | 日付 | `PartsSetting_Date` |
| `time` | 時刻 | `PartsSetting_Time` |
| `number_v2` | 数値 | `PartsSetting_Number_v2` |
| `list` | リストメニュー | `PartsSetting_List` |
| `checkbox` | チェックボックス | `PartsSetting_Checkbox` |
| `radio` | ラジオボタン | `PartsSetting_Radio` |
| `attachment` | 添付ファイル | `PartsSetting_Attachment` |
| `image` | 画像 | `PartsSetting_Image` |
| `lookup` | マスター連携 | `PartsSetting_Lookup` |
| `calculate` | 自動計算 | `PartsSetting_Calculate` |
| `excelimport` | Excel添付取込 | `PartsSetting_Excelimport` |
| `label` | ラベル | `PartsSetting_Label` |
| （`tables` キー固定） | テーブル（明細） | `PartsSetting_Tables` |

補足として、本プロジェクトのkintone連携に関わる `lookup`（マスター連携パーツ）は `master_type` に `kintone` を指定でき、検索条件（`search_keys`）・検索結果表示列（`search_result`）・値の配置先（`data_placements`）を持ちます。既存フォームでkintoneマスター連携パーツを使っている場合、取得JSONの当該パーツで設定内容を確認できます。

### レスポンス例

```json
{
  "app_cd": 1,
  "error": false,
  "total_count": 2,
  "version": 1,
  "parts": {
    "fidText": {
      "name": "テキスト",
      "type": "text",
      "hint": "テキストパーツのヒントです。",
      "comment": "テキストパーツのコメントです。",
      "required": false,
      "max_length": 20,
      "default": "デフォルトテキストです。",
      "input_format": "half_width",
      "display_format": "half_width_lowercase",
      "display": true,
      "order": 1
    }
  }
}
```

（フル例は [openapi.yaml](openapi.yaml) 内 `getFormParts` の `example` を参照）

## 本プロジェクトでの利用手順

1. [../forms/](../forms/) のExcelひな形をコラボフローにインポートし、フォームに変換・公開する
2. `getFormParts` APIで `form_id` と `form_version`（通常 `latest`）を指定してJSON構造を取得する
3. 取得したJSONを [../forms/json/](../forms/json/) に、対応するExcelひな形と同じ命名規則で保存する（詳細は [../forms/README.md](../forms/README.md) 参照）
4. パーツID・タイプを確認しながら、[../collaboform-js-api/](../collaboform-js-api/) のJavaScript APIカスタマイズ（`parts.<パーツID>` での値取得・設定、`form.<パーツID>.change` イベント等）を実装する
