# Prepare a source release

Release readiness and public publication are separate actions. v0.1.0 is scoped
by launch-readiness.md. Do not expand platform support while closing that release.

1. Run the shared deterministic checks, dependency audits and independent secret
   scan. Verify an exported installation, public smoke, supported native host
   tasks and held frames. Record actual versions and untested combinations in
   verification.md. Never put raw local model logs or private paths in that doc.
2. Update the changelog and third-party notices. Keep attribution accurate; the
   project's MIT license does not replace dependencies' terms.
3. Review bundles/source.json. It explicitly includes public implementation,
   tests, examples and development files; runtime packaging is bundles/demo.json.
   The private development repository can contain internal history, so never
   publish it by simply adding a remote and pushing.
4. Export to a new directory outside the development checkout:

   ```sh
   python3 scripts/release.py --out /path/to/new-public-candidate --author-name 'Your public name' --author-email 'ID+USERNAME@users.noreply.github.com'
   ```

   Use the exact noreply address from GitHub Settings -> Emails. The exporter
   creates one new main commit and no remote. It does not rewrite or delete the
   original development repository. It disables commit hooks for that candidate
   and explicitly applies the supplied public identity.
5. Scan the exported files and all intended public refs with an independent
   scanner such as Gitleaks. Run `npm run check -- --public-history --python
   <python-with-Pillow>` from the candidate after installing its development
   dependencies. Install its Demo bundle to a separate path and run smoke.
6. Review the candidate tree, license, README and scope with the owner. Only
   after publication is authorized, create/push the intended repository and
   release tag. Enable private vulnerability reporting and verify the first
   remote CI run. Never upload local captures, cookies, keys or raw evaluation
   logs as release assets.

A successful local gate is not evidence of remote CI, a public URL, or user
acceptance. Report those states separately. Keep the original private history
and local evidence available for audit.
