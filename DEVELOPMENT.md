# 開発ガイド

[AppDock共通指示](../AppDock.at365/AGENTS.md)、[Applet API](../AppDock.at365/docs/extensions.md)、[読み上げ設計](../AppDock.at365/docs/speech-applet-design.md)、[共通固定ランタイム](../AppDock.at365/docs/test-runtime.md)を正本とする。

利用方法は[Speakの使い方](docs/usage.md)を参照する。外部依存のないNode CommonJS Applet。`src/processing.cjs`がCSV検証・置換・分割、`src/dictionary-store.cjs`がCSV保存・辞書統合・索引の寿命、`index.cjs`が宣言型設定とMCP handlerを所有する。`extension.json`が版・最低ホスト版・設定・MCP宣言の正本。

辞書の検索は`src/dictionary-engine.cjs`の連続配列型トライで行う。[辞書エンジンとCSV保存](docs/dictionary-engine.md)で検索契約・保存構成・メモリ上の切り替えを定義する。

「辞書変換」の`dictionaryIgnoreCase`は半角英字の照合方式を選ぶ通常設定で、初期true。同じ索引に元の表記と優先順位を持たせ、プレビュー/MCPの設定snapshotから選択する。切り替えで辞書ファイルを読まず、索引も再構築しない。

設定タブと補助ボタンは[共通設定ページ](../AppDock.at365/docs/extensions.md#共通の設定ページ)と[provider toolbar](../AppDock.at365/docs/applet-providers.md#設定と表示)で宣言する。単語一覧・配布辞書一覧・優先順・編集ダイアログは本体の共通部品を使用する。通常設定と`helpers`へ辞書を複製しない。AppDock 0.249.0以降の[ファイルStorage](../AppDock.at365/docs/storage-files.md)を`configuration` scopeで使う。既存のSettings内の辞書は使用せず、移行を実装しない。

`test.bat`は本体の固定Nodeで`tests/*.test.cjs`を実行する。`publish.bat`はテスト後に明示したファイルだけを発行先の`extensions/at365.speak`へ配置し、共通pack-applet-update.ps1で更新ZIP/JSONを作る。発行先は共通publish-paths.ps1で解決する。外部公開と実利用先への配置は別操作。

本体との結合試験は本体`scripts/applet-api-ui-test.cjs`を使い、検証結果・入力ハッシュは[VERIFICATION](VERIFICATION.md)へ記録する。実サーバー品質と物理出力はfixtureによる受付・プレイヤー完了と区別する。

複数辞書の画面試験は本体の`dev.bat exec node <このrepo>/scripts/dictionary-ui-test.cjs <固定EXE> <発行済みApplet>`で行う。共通ランタイムを使用し、profileと結果を本repoの`.artifacts`へ保存する。ユーザーCSVの往復、10万件の配布CSV、順序・有効状態・再取り込み、共有／PC専用、再起動を対象とする。`scripts/dictionary-benchmark.cjs --store <出力先>`を`dev.bat exec node --expose-gc`で実行すると、CSVと編集用行を含む辞書全体の保持量を5万・10万件で測定できる。既定モードの索引単体比較とは測定範囲を分ける。

結合試験の既定入力は兄弟repoの`Applet.Speak.at365`。発行済みAppletを検証する場合は`APPDOCK_TEST_SPEAK_APPLET`へ`extension.json`のある配布フォルダーを指定する。正式名は`Applet.Speak.at365`、Applet IDは`at365.speak`、モジュールIDは`at365.speak.read-aloud`。MCPの公開名はRelay/Voiceと共通の`appdock_speech_speak`を使う。
