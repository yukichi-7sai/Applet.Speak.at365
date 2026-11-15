# 開発の入口

[AppDock共通技術指示](../AppDock.at365/AGENTS.md)、[Applet実装ガイド](../AppDock.at365/docs/applet-development.md)、[DEVELOPMENT](DEVELOPMENT.md)を参照する。
通常設定は本体Settings APIを使い、MCP公開スイッチは本体所有の設定部品だけで操作する。プレビューから通信・生成・再生を行わない。生成と再生は本体の連続読み上げAPIへ委譲する。
