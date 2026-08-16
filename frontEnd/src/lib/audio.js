// Chrome bug: MediaRecorder-produced webm often reports duration as 0/Infinity/NaN until
// the element is seeked once — force that here. Guarded by a WeakSet so the seek-triggered
// durationchange/timeupdate events this causes don't loop back into fixing it again.
const audioDurationFixed = new WeakSet()

export function fixAudioDuration(el) {
  if (audioDurationFixed.has(el)) return
  if (el.duration && isFinite(el.duration)) return
  audioDurationFixed.add(el)
  el.currentTime = 1e7
  const onTimeUpdate = () => {
    el.currentTime = 0
    el.removeEventListener("timeupdate", onTimeUpdate)
  }
  el.addEventListener("timeupdate", onTimeUpdate)
}

// Shared MediaRecorder-based voice-note recording helper. Picks a browser-supported
// mimeType, records via getUserMedia, patches real duration metadata into webm blobs
// (fix-webm-duration) since MediaRecorder-produced webm has none by default, and hands
// back a ready-to-upload File via onDone.
export async function recordVoiceNote({ onStart, onDone, onError }) {
  try {
    const fixWebmDuration = (await import("fix-webm-duration")).default
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
    const supportedType = preferredTypes.find((t) => MediaRecorder.isTypeSupported?.(t))
    const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream)
    const chunks = []
    const startedAt = Date.now()
    recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data) }
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const actualType = recorder.mimeType || "audio/webm"
      const ext = actualType.includes("mp4") ? "m4a" : actualType.includes("ogg") ? "ogg" : "webm"
      const durationMs = Date.now() - startedAt
      let blob = new Blob(chunks, { type: actualType })
      if (actualType.includes("webm") && durationMs > 0) {
        try {
          blob = await fixWebmDuration(blob, durationMs, { logger: false })
        } catch (err) {
          console.error("fixWebmDuration failed, uploading unpatched blob:", err)
        }
      }
      const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: actualType })
      onDone(file)
    }
    recorder.start()
    onStart(recorder)
  } catch (err) {
    onError(err)
  }
}
