import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client.ts';
import { BookFrame } from './frame.tsx';
import { usePrivacyNotice } from './privacy-query.ts';

/**
 * The shop's privacy notice (openspec/changes/finish-account design 7; Jack,
 * 9 Nov, answer 2; "Privacy notice" on ac-account): the Owner's own words, as
 * typed, line breaks kept, in the booking frame. Not drawn; a page of its own
 * as the conversation is, back to the account.
 */
export function PrivacyScreen() {
  const { shopSlug = '' } = useParams();
  const notice = usePrivacyNotice(shopSlug);
  const back = { back: `/book/${shopSlug}/account`, backLabel: 'Your account' };
  if (notice.isPending) return <BookFrame title="Privacy notice" {...back}>{null}</BookFrame>;
  if (notice.isError && notice.error instanceof ApiError && notice.error.status === 404) {
    return (
      <BookFrame title="Privacy notice" {...back}>
        <p className="m-0">This shop hasn’t added a privacy notice yet.</p>
      </BookFrame>
    );
  }
  if (notice.isError || !notice.data) {
    return (
      <BookFrame title="We couldn’t load the privacy notice" {...back}>
        <div><Button variant="accent" onClick={() => notice.refetch()}>Try again</Button></div>
      </BookFrame>
    );
  }
  return (
    <BookFrame title="Privacy notice" {...back}>
      <p className="m-0 whitespace-pre-wrap break-words text-size-15 leading-relaxed">{notice.data.text}</p>
    </BookFrame>
  );
}
