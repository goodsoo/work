import type { Meeting } from "../../api/meetings";
import { TimelineBlock } from "./TimelineBlock";
import { Text } from "../common/Text";

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
        <Text variant="h4" weight="normal" as="div">
          {title}
        </Text>
        {meta.length > 0 ? (
          <Text variant="body" color="secondary" as="div" className="mt-0.5">
            {meta.join(" · ")}
          </Text>
        ) : null}
      </div>
    </TimelineBlock>
  );
}
