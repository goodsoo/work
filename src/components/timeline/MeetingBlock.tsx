import type { Meeting } from "../../api/meetings";
import { TimelineBlock } from "./TimelineBlock";

type Props = {
  meeting: Meeting;
  onOpen: () => void;
};

export function MeetingBlock({ meeting, onOpen }: Props) {
  const title = meeting.title?.trim() || "(제목 없음)";
  const meta: string[] = [];
  if (meeting.attendees?.trim()) meta.push(meeting.attendees.trim());
  if (meeting.time?.trim()) meta.push(meeting.time.trim());

  return (
    <TimelineBlock letter="M" onClick={onOpen}>
      <div>
        <div className="text-base text-zinc-900 dark:text-zinc-100">{title}</div>
        {meta.length > 0 ? (
          <div className="mt-0.5 text-sm text-zinc-500">
            {meta.join(" · ")}
          </div>
        ) : null}
      </div>
    </TimelineBlock>
  );
}
