import type { Meeting } from "../../api/meetings";
import { TimelineBlock } from "./TimelineBlock";

type Props = {
  meeting: Meeting;
  onOpen: () => void;
};

export function MeetingBlock({ meeting, onOpen }: Props) {
  const title = meeting.title?.trim() || "(제목 없음)";
  const meta: string[] = [];
  if (meeting.attendees && meeting.attendees.length > 0)
    meta.push(meeting.attendees.join(", "));
  if (meeting.time?.trim()) meta.push(meeting.time.trim());

  return (
    <TimelineBlock letter="M" onClick={onOpen}>
      <div>
        <div className="text-base" style={{ color: "var(--text-primary)" }}>{title}</div>
        {meta.length > 0 ? (
          <div
            className="mt-0.5 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {meta.join(" · ")}
          </div>
        ) : null}
      </div>
    </TimelineBlock>
  );
}
