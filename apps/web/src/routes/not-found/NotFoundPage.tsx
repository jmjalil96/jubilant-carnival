import RouteStateMessage, {
  StatePrimaryLink,
} from "@/components/feedback/RouteStateMessage";

function NotFoundPage() {
  return (
    <RouteStateMessage
      eyebrow="Not Found"
      title="That page does not exist."
      description="The route matched the web shell, but there is no page configured for this URL."
    >
      <StatePrimaryLink to="/">Return home</StatePrimaryLink>
    </RouteStateMessage>
  );
}

export default NotFoundPage;
