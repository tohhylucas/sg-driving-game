import { INSTRUCTOR_CONFIG } from '../config/constants';
import type { InstructorTtsAdapter } from './InstructorInstructionQueue';

/** Speaks instructor prompts with the browser Web Speech API when available. */
export class BrowserTtsAdapter implements InstructorTtsAdapter {
  speak(utterance: string): Promise<void> {
    if (
      typeof window === 'undefined' ||
      !window.speechSynthesis ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const speech = new SpeechSynthesisUtterance(utterance);

      speech.lang = INSTRUCTOR_CONFIG.ttsLanguage;
      speech.onend = () => resolve();
      speech.onerror = () => resolve();
      window.speechSynthesis.speak(speech);
    });
  }

  cancel(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
