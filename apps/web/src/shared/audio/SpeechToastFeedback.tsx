import { useEffect } from 'react';
import { useToast } from '@nihongo/client/toast';
import { subscribeSpeechErrors } from './speech';

export function SpeechToastFeedback() {
  const toast = useToast();
  // Subscribe to each attempt so the same error can be shown again after dismissal.
  useEffect(() => subscribeSpeechErrors(message => { toast.warning(message); }), [toast]);
  return null;
}
