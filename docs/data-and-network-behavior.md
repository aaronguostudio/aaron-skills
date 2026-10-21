# Data and network behavior

The Demo bundle operates locally. Installation downloads dependencies and browser binaries. Recording contacts only the adapter's configured hosts during guarded capture. An interactive sign-in window is not host-locked; the user performs sign-in. Requested cloud narration sends supplied text to the selected ElevenLabs/Google account or configured company speech endpoint. Optional Kokoro installation downloads public Python packages and model files; its synthesis then uses local files without a cloud speech call. Keys entered in the voice wizard stay in a separate private user-level credential file; they are not bundled, logged or put in render manifests. No service is selected as an automatic fallback.

Sessions use private local directories and files outside Git. POSIX uses owner-only modes; Windows removes inherited/other-user DACL entries and grants the current user access on NTFS, with independent readback checks. This is local access control, not encryption or protection from an administrator. Installation stops if it cannot enforce private state permissions. Captures contain real screens, and update pages embed screenshots. Inspect them before sharing; automatic personal-data redaction is not implemented.

Adapters and walks are trusted JavaScript executed on the user's machine. The browser guard is not a sandbox for malicious scripts. HTTP method filtering does not inspect WebSocket message contents or prove server-side read-only semantics. Retain explicit host and read exceptions, production gates, and documented redirect limitations from project-adapters.md.

No publishing, messaging, analytics collection, or upload is part of the default flow.
