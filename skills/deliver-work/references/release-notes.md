# Release notes

Read when preparing version notes, feature announcements or an ongoing record
of delivered changes. Use the project's format and intended audience. Release
notes explain the change; writing them is not a release operation.

## Establish what is actually included

Use the real change set, scope decisions and relevant verification. Confirm the
version/revision and destination when supplied. Label unpublished or planned
notes accordingly; do not infer a release date or production availability from
a merged PR, passing CI or local build. Distinguish deployed code, enabled flags,
eligible users and actual customer acceptance.

Group by effects readers care about. Explain the concrete trigger and resulting
behavior where useful, including fixes and compatibility consequences. A commit
list or implementation diary may help engineers trace the work, but it does not
replace a reader-facing explanation. Preserve technical details that help the
intended audience assess an upgrade or integration.

## Include the action and limits that matter

When relevant, cover who can use the change, where/how to start, migrations or
configuration required, compatibility changes, meaningful known issues and a
supported recovery/support path. Keep dates, contacts and commitments grounded
in supplied information. Do not add boilerplate sections with invented content.

Do not advertise capabilities outside the verified scope or fold proposals into
the release. Describe an untested boundary when it affects adoption. A capability
not included in this delivery is different from a known defect.

An authored fictional draft might say:

> **Test release candidate — shared queue views**
>
> The repair queue preserves status and sort order in its link. Reopening a
> Pending / Oldest first link restores those conditions; displayed records
> continue to reflect current data. This candidate has been checked in the test
> environment. Production availability has not been established.

The example does not establish a real release. Use the actual task's audience,
checks and availability before presenting similar wording as fact.

## Reconcile the communications

Check notes, announcement, help text and operational handoff for the same scope,
version, terms and availability. Keep detailed engineering evidence accessible
where useful without exposing private logs or paths in public notes. After an
authorized release, update status based on observed release evidence; don't leave
a planned date or a draft label standing in for what actually happened.
