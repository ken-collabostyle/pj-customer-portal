# parts オブジェクトリファレンス

出典: [パーツのデータと状態の操作](https://collaboform.zendesk.com/hc/ja/articles/16958110374159)

イベントハンドラーの引数 `data` オブジェクトには `parts` オブジェクトが含まれます。`parts` を使って、パーツのデータ参照・値のセット・表示/非表示の切り替えが可能です。

## parts オブジェクトの例

```javascript
parts: {
  fidDeliveryPoint: {
    'type': 'text',
    'enabled': true,
    'display': true,
    'value': '神奈川事業所'
  },
  fidDeliveryType: {
    'type': 'list',
    'enabled': true,
    'display': true,
    'value': '定期便'
  },
  tbl_1: {
    'type': 'table',
    'enabled': false,
    'display': true,
    'value': [
      {
        'fidItemName': { 'value': '純正トナーカートリッジ', 'type': 'text', 'enabled': false, 'display': true },
        'fidItemCount': { 'value': '2', 'type': 'number', 'enabled': false, 'display': true }
      },
      {
        'fidItemName': { 'value': 'コピー用紙A4', 'type': 'text', 'enabled': false, 'display': true },
        'fidItemCount': { 'value': '10', 'type': 'number', 'enabled': false, 'display': true }
      }
    ]
  }
}
```

`fidDeliveryPoint` / `fidDeliveryType` はテーブル外の通常パーツ、`tbl_1` の `value` はテーブル内パーツを示す（明細のテーブルIDは常に `tbl_1`）。

## parts オブジェクトのプロパティ

| プロパティ | 説明 | 型 |
|---|---|---|
| `value` | パーツの値 | any |
| `type` | パーツのタイプ | string |
| `enabled` | 入力可能なら `true`、不可なら `false` | boolean |
| `display` | 表示状態なら `true`、非表示なら `false` | boolean |

## value プロパティの取得値（パーツタイプ別）

| type | パーツ種別 | 取得する値の詳細 | 補足 |
|---|---|---|---|
| `text` | テキスト（一行）パーツ | 入力された値 | - |
| `number` | テキスト（一行）パーツ 数値型 | 入力された値 | カンマは含まれない |
| `number_v2` | 数値パーツ | 入力された値 | カンマは含まれない |
| `money` | テキスト（一行）パーツ 金額型 | 入力された値 | カンマは含まれない |
| `textarea` | テキストエリアパーツ | 入力された値 | - |
| `date` | 日付パーツ | 入力された値 | Dateオブジェクトで返る |
| `list` | リストメニューパーツ | 選択された「項目名」 | - |
| `checkbox` | チェックボックスパーツ | ON: チェック時の表示コメント / OFF: 未チェック時の表示コメント | - |
| `radio` | ラジオボタンパーツ | 選択された「項目名」 | - |
| `lookup` | マスター連携パーツ | 入力された値 | - |
| `label` | ラベルパーツ | 指定された「ラベルの内容」 | - |
| `calculate` | 自動計算パーツ | 計算済みの値 | 読み取り専用 |
| `excelimport` | Excel添付取込パーツ | 添付ファイル情報（ファイル名・サイズ） | 読み取り専用。再利用フォーム／`form.view` ではサイズ取得不可 |
| `attachment` | 添付ファイルパーツ | 添付ファイル情報（ファイル名・サイズ） | 読み取り専用。再利用フォーム／`form.view` ではサイズ取得不可 |
| `table` | テーブルパーツ | 行ごとのパーツオブジェクトを配列で格納 | - |

未対応パーツ（時刻パーツ・画像パーツ）は `parts` オブジェクトに含まれません。対応パーツ一覧: [コラボフォームに対応しているフォームパーツと設定](https://collaboform.zendesk.com/hc/ja/articles/8471313195791)

## value プロパティへの値設定（パーツタイプ別の挙動）

| type | パーツ種別 | 値セット時の挙動 | 補足 |
|---|---|---|---|
| `text` | テキスト（一行）パーツ | 指定値がセットされる | - |
| `number` | テキスト（一行）パーツ 数値型 | 指定値がセットされる | フォーマット（小数点桁数・カンマ）を反映するには数値型で設定する必要あり |
| `number_v2` | 数値パーツ | 指定値がセットされる | - |
| `money` | テキスト（一行）パーツ 金額型 | 指定値がセットされる | フォーマット反映には金額型で設定する必要あり |
| `textarea` | テキストエリアパーツ | 指定値がセットされる | - |
| `date` | 日付パーツ | 指定値がセットされる | - |
| `list` | リストメニューパーツ | 指定値と一致する「項目名」が選択される | 存在しない選択肢はセット不可 |
| `checkbox` | チェックボックスパーツ | 指定値が「チェック時の表示コメント」と一致すればONになる | 存在しない選択肢はセット不可 |
| `radio` | ラジオボタンパーツ | 指定値と一致する「項目名」が選択される | 存在しない選択肢はセット不可 |
| `lookup` | マスター連携パーツ | 指定値がセットされる | - |
| `label` | ラベルパーツ | 「ラベルの内容」が書き換わる | - |
| `calculate` | 自動計算パーツ | 反映されない | 読み取り専用 |
| `excelimport` | Excel添付取込パーツ | 反映されない | 読み取り専用 |
| `attachment` | 添付ファイルパーツ | 反映されない | 読み取り専用 |
| `table` | テーブルパーツ | 内部パーツの `value` を書き換えるとテーブル外パーツと同様に反映 | - |

## display プロパティへの値設定

画面表示中のパーツであれば、イベントハンドラー内で `display` を書き換えてパーツの表示/非表示を切り替え可能。

## 制限事項

- 未対応パーツ（時刻パーツ・画像パーツ）は `parts` オブジェクトに含まれない（操作対象外）。
- `enabled` は取得のみ可能（設定によるパーツ有効/無効の変更は不可）。
- `form.confirm.show` / `form.submit` / `form.view` では `value` の書き換えによるパーツ値変更は不可。
- テーブルパーツのIDは `tbl_1` 固定。
- 自動計算パーツ・ラベルパーツ・テーブルパーツの `enabled` は常に `false`。
- テーブルパーツの `display` を `false` にして非表示にすることはできない（テーブル**内**パーツの `display` はテーブル外パーツ同様に変更可能）。
- 添付ファイルパーツ・Excel添付取込パーツは、フォーム再利用時および `form.view`（送信済みフォーム閲覧画面）ではファイルサイズを取得できない。
