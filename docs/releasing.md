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

   Choose the author name and commit email you want to publish; a GitHub noreply
   address is optional. This exporter is only for creating a new public source
   repository from private sources. Update the existing public repository through
   ordinary PRs and merges, preserving its history. The exporter
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

## Stable update assets

Before a stable release, synchronize the version in `package.json`, its lockfile
and both bundle manifests. In `bundles/demo.json`, review the `update` declaration:

- `kind: compatible` is only for verified compatible patches in the same
  major/minor series. Use `review` for behavior, format, permission, prerequisite
  or other changes users must evaluate.
- `compatibilityEpoch` stays constant only while every version in that epoch
  remains compatible. **Bump it for any incompatible change**, including an
  incompatible patch, and never reuse an earlier epoch. This prevents users who
  skipped a breaking release from silently installing a later patch.
- `summary` contains 1–7 short, user-facing change notes. The declaration is
  bundled and checksum-bound, not inferred from Git commit messages.

The initial updater declaration is `review`; existing users must acquire the
updater once through setup. Do not retroactively attach new content to an old tag.

From a clean committed checkout, prepare outside Git:

```sh
python3 scripts/prepare_update.py --tag vX.Y.Z --out /path/to/new-update-assets
```

This creates `aaron-skills-demo-X.Y.Z.tar.gz` and `aaron-skills-update.json`.
The archive contains only the allowlisted Demo export. The descriptor binds its
SHA-256 to the source commit, bundle identity, version and update policy.
Run `scripts/verify-updates.py` on an isolated installation as well as doctor and
smoke before authorizing a release. The verifier uses a loopback synthetic feed
and no customer application, public publication or paid provider.

After a maintainer publishes a stable GitHub Release, `update-assets.yml` checks
that the tagged commit is reachable from Git `main`, prepares the assets, and
attaches the archive **before** its descriptor. Drafts/prereleases are excluded.
Missing/incomplete assets leave update status unknown. Publishing a release is
still a separately authorized action; adding this workflow does not publish one.
