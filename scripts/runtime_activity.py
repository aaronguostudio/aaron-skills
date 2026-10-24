"""OS-owned task locks: a crashed process cannot leave an installation busy."""
from contextlib import contextmanager
import os


def windows_lock(handle, exclusive):
    # CRT _LK_NBRLCK is exclusive too. LockFileEx provides actual shared locks,
    # so smoke -> render/page and concurrent commands cannot deadlock each other.
    # https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-lockfileex
    import ctypes
    from ctypes import wintypes
    import errno
    import msvcrt
    class Overlapped(ctypes.Structure):
        _fields_ = [('Internal', ctypes.c_size_t), ('InternalHigh', ctypes.c_size_t),
                    ('Offset', wintypes.DWORD), ('OffsetHigh', wintypes.DWORD), ('hEvent', wintypes.HANDLE)]
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.LockFileEx.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.DWORD,
                                 wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(Overlapped)]
    kernel.LockFileEx.restype = wintypes.BOOL
    kernel.UnlockFileEx.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.DWORD,
                                   wintypes.DWORD, ctypes.POINTER(Overlapped)]
    kernel.UnlockFileEx.restype = wintypes.BOOL
    native = msvcrt.get_osfhandle(handle.fileno())
    overlap = Overlapped()
    def acquire():
        if not kernel.LockFileEx(native, 1 | (2 if exclusive else 0), 0, 1, 0, ctypes.byref(overlap)):
            code = ctypes.get_last_error()
            if code == 33:  # ERROR_LOCK_VIOLATION
                raise BlockingIOError(errno.EACCES, 'Runtime activation/task lock is busy')
            raise ctypes.WinError(code)
    def release():
        if not kernel.UnlockFileEx(native, 0, 1, 0, ctypes.byref(overlap)):
            raise ctypes.WinError(ctypes.get_last_error())
    return acquire, release


@contextmanager
def runtime_activity(root, *, exclusive=False, blocking=False):
    root.mkdir(parents=True, exist_ok=True)
    with (root / '.runtime.lock').open('a+b', buffering=0) as handle:
        if os.name == 'nt':
            acquire, release = windows_lock(handle, exclusive)
        else:
            import fcntl
            def acquire():
                fcntl.flock(handle, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH) | fcntl.LOCK_NB)
            def release():
                fcntl.flock(handle, fcntl.LOCK_UN)
        while True:
            try:
                acquire()
                break
            except OSError as error:
                if error.errno not in (11, 13, 35, 36):
                    raise
                if not blocking:
                    raise ValueError('Demo is busy; the active version was preserved. Retry after the current task finishes.') from None
                import time
                time.sleep(0.05)
        try:
            yield
        finally:
            release()
