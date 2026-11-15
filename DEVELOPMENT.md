# 開発ガイド

[AppDock共通指示](../AppDock.at365/AGENTS.md)、[Applet API](../AppDock.at365/docs/extensions.md)、[読み上げ設計](../AppDock.at365/docs/speech-applet-design.md)、[共通固定ランタイム](../AppDock.at365/docs/test-runtime.md)を正本とする。

外部依存のないNode CommonJS Applet。`src/processing.cjs`がCSV・辞書・分割、`index.cjs`が宣言型設定の補助操作とMCP handlerを所有する。`extension.json`が版・最低ホスト版・設定・MCP宣言の正本。

`test.bat`は本体の固定Nodeで`tests/*.test.cjs`を実行する。`publish.bat`はテスト後に明示したファイルだけを発行先の`extensions/at365.speak`へ配置し、共通pack-applet-update.ps1で更新ZIP/JSONを作る。発行先は共通publish-paths.ps1で解決する。外部公開と実利用先への配置は別操作。

本体との結合試験は本体`scripts/applet-api-ui-test.cjs`を使い、検証結果・入力ハッシュは[VERIFICATION](VERIFICATION.md)へ記録する。実サーバー品質と物理出力はfixtureによる受付・プレイヤー完了と区別する。

結合試験の既定入力は兄弟repoの`Applet.Speak.at365`。発行済みAppletを検証する場合は`APPDOCK_TEST_SPEAK_APPLET`へ`extension.json`のある配布フォルダーを指定する。正式名は`Applet.Speak.at365`、Applet IDは`at365.speak`、モジュールIDは`at365.speak.read-aloud`。MCPの公開名はRelay/Voiceと共通の`appdock_speech_speak`を使う。
