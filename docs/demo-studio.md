# Team templates in Housecut

Install the full Aaron Skills runtime and open [Housecut](https://skills.aaronguo.com/housecut). Sign in with the email your teammate invited. Under **Workspaces**, accept the invitation to open **Local agent** with your assigned template. Run the connection command shown there once per OS account and workspace, then enter the code from your terminal in the browser. The device may read published templates for 90 days. It cannot upload recordings, manage billing or edit the team.

When asked to film a demo with the team template, resolve it before rendering:

```sh
aaron-demo studio resolve --project <existing-local-run-directory>
aaron-demo render <passed-capture> --presentation <resolved-presentation-path> --cover --out <output.mp4>
```

Use the path returned by the first command. A project pins its first approved version and logo. A new project receives the current published version. For disconnected revisions of a pinned project, explicitly use `resolve --offline`. Previously downloaded files remain on the computer. For a new cut, provide the real passed capture first. Review the resulting MP4 before choosing an upload in the web library.

`aaron-demo studio status` checks online access. `aaron-demo studio disconnect` revokes access and removes the local credential. The browser can also revoke a device or remove a member. The normal credential store is the OS keychain. A headless user may expressly choose an owner-only file with `--file-credential`.
