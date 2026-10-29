# Google speech

Open a teaching or practice chat, expand **Speech options**, and choose **Google AI · English tutor** or **Google AI · Italian tutor**. The default voice is Sulafat; model selection and speed are configurable. Each visible assistant text passage has its own reader, including older grouped replies. Only the passage still being generated is unavailable while it changes.

Add your own Gemini API key in **Settings → Providers → Read aloud → Google speech**. The dedicated server-side variable is `GEMINI_TTS_API_KEY`; it is independent of the teaching provider's key. The settings field is masked and the key is not stored in browser preferences.

Only a requested, uncached passage is sent to Google. Long passages are split at up to 1,800 Unicode code points. Generation is sequential without automatic retries or model fallback. Pause and speed changes reuse the recording; changing language/model/voice can require a new one. Stop cancels playback and future chunks; Google may still finish an already accepted request, which can consume quota.

Recordings are stored under the configured data directory's `speech/` folder. They survive app restarts and consume disk space until removed. Removing the cache requires regeneration next time. Quota errors stop playback; inspect your project limits in Google AI Studio. The app cannot enforce or determine the project's Free/Paid tier from the API key.

Only learner-visible text is passed to the reader. Code fences, HTML and diagram source are skipped; formulas are spoken literally. Hidden answers and model reasoning are excluded. Selecting Italian changes delivery, not the lesson language or text. On-device speech remains an explicit alternative.

Google documentation: https://ai.google.dev/gemini-api/docs/speech-generation
Google terms: https://ai.google.dev/gemini-api/terms
Google quotas: https://aistudio.google.com/rate-limit
