# イベントリファレンス

出典:
- [利用可能な画面、イベントの一覧](https://collaboform.zendesk.com/hc/ja/articles/16957867618447)
- [イベントの記述方法](https://collaboform.zendesk.com/hc/ja/articles/16957908625935)
- [フォーム入力画面イベント](https://collaboform.zendesk.com/hc/ja/articles/16957885865743)
- [入力内容確認画面イベント](https://collaboform.zendesk.com/hc/ja/articles/16957911125007)
- [フォーム詳細画面イベント](https://collaboform.zendesk.com/hc/ja/articles/16957880850959)

## 利用可能な画面

| 画面 | 内容 |
|---|---|
| フォーム入力画面 | 公開フォームの入力画面 |
| 入力内容確認画面 | 公開フォームの入力確認画面 |
| フォーム詳細画面 | マイページ、フォーム詳細画面、メンバー詳細画面から送信済みフォームを閲覧する画面 |

※いずれもフォーム設定＞表示設定の**プレビューには適用されません**。

## イベント一覧

| 画面 | タイミング | イベント名（ハンドラー） | 備考 |
|---|---|---|---|
| フォーム入力画面 | 表示後 | `form.show` | 公開フォームの入力画面が表示されたときに実行 |
| フォーム入力画面 | パーツ値変更時 | `form.<パーツID>.change` | 指定パーツの値が変更されたときに実行。パーツIDはコラボフローのフォーム編集画面で確認 |
| フォーム入力画面 | 確認ボタン押下時 | `form.confirm` | 確認ボタンクリック時に実行 |
| 入力内容確認画面 | 表示後 | `form.confirm.show` | 入力確認画面が表示されたときに実行 |
| 入力内容確認画面 | 送信ボタン押下時 | `form.submit` | 送信ボタンクリック時に実行 |
| フォーム詳細画面 | 表示後 | `form.view` | 送信済みフォームの詳細を開いたときに実行 |

## イベントの記述方法

```javascript
collaboform.events.on(eventName, function (data) { });
```

| 引数名 | 指定する値 | 必須 | 説明 |
|---|---|---|---|
| `eventName` | 文字列 または 文字列の配列 | 必須 | 対象のイベント名。配列を指定した場合は全イベントが対象 |
| `handler` | `function(data)` | 必須 | イベント発生時に実行されるハンドラー。`data` にイベントデータが渡される |

```javascript
// フォーム入力画面を開いた際のイベント
collaboform.events.on('form.show', function (data) { });

// 確認ボタンが押された際のイベント
collaboform.events.on('form.confirm', function (data) { });

// 複数のイベントに同じハンドラーを登録する（配列指定）
collaboform.events.on(['form.confirm', 'form.submit'], function (data) { });
```

### `data` オブジェクトの共通プロパティ

イベントによっては、以下に加えイベント独自のプロパティが渡されます。

| プロパティ名 | 説明 | 型 |
|---|---|---|
| `event_name` | 発生したイベント名 | string |
| `parts` | パーツ値情報（詳細は [parts-reference.md](parts-reference.md)） | object |
| `parts_id` | 変更されたパーツのID（`form.<パーツID>.change` 時のみ） | string |
| `row_index` | 行インデックス（明細パーツの変更イベント時のみ。1行目は `1`） | number |
| `table_id` | テーブルID（明細パーツの変更イベント時のみ。コラボフォームでは `tbl_1` 固定） | string |

### 補足・制限事項

- `parts` オブジェクトの `value` を書き換えると、その変更がフォームに反映される。
- `parts` オブジェクトの `display` を書き換えると、パーツの表示/非表示を変更できる。
- 未対応パーツ（時刻パーツ・画像パーツ）は `parts` オブジェクトに含まれない。
- `enabled` 値は取得のみ可能（設定不可）。
- `form.confirm.show` / `form.submit` / `form.view` では、`value` を書き換えてパーツ値を変更することはできない。
- カスタムJavaScriptファイルはフォーム画面のDOMが確定する**前**に読み込まれる。イベントハンドラーの外に処理を書くと、要素が未生成で正常動作しない場合がある。

## 画面別イベント詳細

### フォーム入力画面

#### `form.show`

フォーム入力画面を開いた際に実行。フォームに自動計算パーツが含まれる場合、初回の自動計算処理が完了してから発火。

```javascript
collaboform.events.on('form.show', function (data) {
  console.dir(data);
});
```

#### `form.<パーツID>.change`

フォーム内のパーツ値が変更された場合に実行。パーツIDはコラボフローのフォーム編集画面で確認。

```javascript
collaboform.events.on('form.fid1.change', function (data) {
  // fid1 の値が変更された際に実行される
  console.dir(data);
});
```

- 明細に配置したパーツも同様の記述で扱う。
- 明細パーツの変更イベントでは `data.row_index`・`data.table_id`（`tbl_1` 固定）を取得可能。

#### `form.confirm`

「確認」ボタンクリック時に実行。

```javascript
collaboform.events.on('form.confirm', function (data) {
  if (data.parts.fidUserType.value === '顧客'
    && data.parts.fidCustomerName.value === '') {
    alert('顧客名は必須です。');
    // false を返すと入力確認画面への遷移を中止
    return false;
  }
  // true を返すか、何も返さないと続行
  return true;
});
```

- `false` を return すると、入力確認画面への遷移を中止できる。
- `collaboform.proxy.call()` などでPromiseオブジェクトをreturnすると、非同期処理完了後に遷移が処理される（[proxy-api.md](proxy-api.md) 参照）。

### 入力内容確認画面

#### `form.confirm.show`

入力内容確認画面を開いた際に自動実行。

```javascript
collaboform.events.on('form.confirm.show', function (data) {
  console.dir(data);
});
```

#### `form.submit`

「送信」ボタンクリック時に実行。

```javascript
collaboform.events.on('form.submit', function (data) {
  // false を返すことで送信処理を停止できる
  alert('処理を中止します');
  return false;
});
```

- `false` を return すると送信処理を中止できる。
- Promiseをreturnすると非同期処理完了後に処理される。
- `form.confirm.show` / `form.submit` では `parts.value` の書き換え不可、`parts.enabled` は `false` の状態で渡される。

### フォーム詳細画面

#### `form.view`

フォーム詳細画面（マイページ、フォーム詳細画面、メンバー詳細画面から送信済みフォームを開いた画面）を開いた際に自動実行。

```javascript
collaboform.events.on('form.view', function (data) {
  console.dir(data);
});
```

- `parts.value` の書き換え不可、`parts.enabled` は `false` の状態で渡される。
- `collaboform.getLoginUser()` で取得できるのは**閲覧しているメンバー**の情報。
- 添付ファイルパーツ・Excel添付取込パーツの `value` からファイルサイズは取得不可（ファイル名のみ取得可）。
