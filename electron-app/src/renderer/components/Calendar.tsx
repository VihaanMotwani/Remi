import React, { useState, useRef, useEffect } from "react";
import styles from "./Calendar.module.css";
import { EventType, DBEventType } from "src/types";
import { fetchTodaysEvents, updateEvent, createEvent, deleteEvent as deleteEventAPI } from "../../api/googleCalendarClient"

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getPriorityColor(priority: 'urgent' | 'high' | 'low') {
  switch (priority) {
    case 'urgent':
      return { bg: '#FFE5E5', border: '#FF6B6B', text: '#CC0000' };
    case 'high':
      return { bg: '#FFF4E5', border: '#FFB84D', text: '#CC7A00' };
    case 'low':
      return { bg: '#E5F4FF', border: '#6BB6FF', text: '#0066CC' };
  }
}

function getEventPosition(event: EventType, dayStart: Date) {
  const dayStartMs = dayStart.getTime();
  const eventStartMs = event.start.getTime();
  const eventEndMs = event.end.getTime();

  // Calculate minutes from day start
  const startMinutes = (eventStartMs - dayStartMs) / (1000 * 60);
  const durationMinutes = (eventEndMs - eventStartMs) / (1000 * 60);

  // Each 15-min slot is 10px tall
  const slotHeight = 10;
  const pixelsPerMinute = slotHeight / 15;
  
  const topPx = startMinutes * pixelsPerMinute + slotHeight;
  const heightPx = durationMinutes * pixelsPerMinute;

  return { topPx, heightPx };
}

const HOURS_IN_DAY = 24;
const SLOT_HEIGHT_PX = 40;
const MIN_EVENT_DURATION_MINUTES = 15;

const CustomCalendar: React.FC = () => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEvent, setModalEvent] = useState<Partial<EventType> | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = React.useState<number | null>(null);
  const [tempEvent, setTempEvent] = useState<EventType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Drag state for moving events
  const draggingEventId = useRef<string | null>(null);
  const dragStartY = useRef<number>(0);
  const dragStartDate = useRef<Date | null>(null);
  const hasDragged = useRef<boolean>(false);

  // Drag state for resizing
  const resizingEventId = useRef<string | null>(null);
  const resizeStartY = useRef<number>(0);
  const resizeStartEndDate = useRef<Date | null>(null);

  const today = new Date();
  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(today);
  dayEnd.setHours(24, 0, 0, 0);

  const slots = [];
  for (let h = 0; h < HOURS_IN_DAY; h++) {
    slots.push(new Date(dayStart.getTime() + h * 60 * 60 * 1000));
  }

  // Current time tracking (updates every 30s)
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  async function loadEvents() {
    try {
      const todaysEvents = await fetchTodaysEvents();
      setEvents(todaysEvents);
    } catch (error) {
      console.error("Error loading events:", error);
      // alert("Failed to load events. Please refresh the page.");
    }
  }
  
  useEffect(() => {
    loadEvents();
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    // Use setTimeout to ensure DOM is fully rendered
    const scrollToCurrentTime = setTimeout(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const containerHeight = container.clientHeight;
        
        // Calculate position of current time indicator
        const quarterSlotPx = SLOT_HEIGHT_PX / 4;
        const pixelsPerMinute = quarterSlotPx / 15;
        const currentTime = new Date();
        const minutesSinceStart = (currentTime.getTime() - dayStart.getTime()) / (1000 * 60);
        const currentTopPx = minutesSinceStart * pixelsPerMinute + quarterSlotPx;
        
        // Scroll to center the current time
        const scrollPosition = currentTopPx - (containerHeight / 2);
        
        container.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });
      }
    }, 100); // Small delay to ensure rendering is complete
    
    return () => clearTimeout(scrollToCurrentTime);
  }, []); // Run once on mount

  const openModal = (event?: EventType, start?: Date, end?: Date) => {
    if (event) {
      setModalEvent({ ...event });
      setEditingEventId(event.id);
      setTempEvent({ ...event });
    } else if (start && end) {
      setModalEvent({ start, end, title: "", priority: 'low', type: 'event' });
      setEditingEventId(null);
      setTempEvent(null);
    }
    setModalOpen(true);
  };

  const onSlotClick = (slotIndex: number) => {
    const start = new Date(dayStart.getTime() + slotIndex * 15 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openModal(undefined, start, end);
  };

  const onEventClick = (event: EventType) => {
    openModal(event);
  };

  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!modalEvent) return;
    const { name, value } = e.target;

    let updatedEvent = { ...modalEvent };

    if (name === "title") {
      updatedEvent = { ...modalEvent, title: value };
    } else if (name === "start" || name === "end") {
      const [hour, minute] = value.split(":").map(Number);
      const newDate = new Date(
        modalEvent[name === "start" ? "start" : "end"] || dayStart
      );
      newDate.setHours(hour, minute, 0, 0);
      updatedEvent = { ...modalEvent, [name]: newDate };
    } else if (name === "priority") {
      updatedEvent = { ...modalEvent, priority: value as 'urgent' | 'high' | 'low' };
    } else if (name === "type") {
      updatedEvent = { ...modalEvent, type: value as 'event' | 'task' };
      if (value === 'task') {
        updatedEvent.completed = false;
      }
    }

    setModalEvent(updatedEvent);

    if (editingEventId && updatedEvent.start && updatedEvent.end) {
      setTempEvent({
        id: editingEventId,
        title: updatedEvent.title || "",
        start: updatedEvent.start,
        end: updatedEvent.end,
        priority: updatedEvent.priority || 'low',
        type: updatedEvent.type || 'event',
        completed: updatedEvent.completed,
      });
    }
  };

  // Convert EventType to DBEventType for API calls
  function eventToDBEvent(event: Partial<EventType>, includeId: boolean = true): Partial<DBEventType> {
    const dbEvent: Partial<DBEventType> = {
      calendar_id: "default",
      title: event.title,
      is_task: event.type === 'task',
      start_time: event.start?.toISOString(),
      end_time: event.end?.toISOString(),
      action_items: {
        priority: event.priority || 'low',
        completed: event.completed || false,
      },
    };
    
    // Only include id if specified and it exists
    if (includeId && event.id) {
      dbEvent.id = event.id;
    }
    
    return dbEvent;
  }

  const saveEvent = async (): Promise<void> => {
    if (!modalEvent || !modalEvent.title || !modalEvent.start || !modalEvent.end) return;
    if (modalEvent.start >= modalEvent.end) {
      // alert("Start time must be before end time.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingEventId) {
        // Update existing event
        const dbEvent = eventToDBEvent(modalEvent, true); // Include id
        await updateEvent({ ...dbEvent, id: editingEventId } as DBEventType);
      } else {
        // Create new event - don't include id
        const dbEvent = eventToDBEvent(modalEvent, false); // Exclude id
        await createEvent(dbEvent as Omit<DBEventType, 'id' | 'created_at'>);
      }

      // Reload events from server to get fresh data
      await loadEvents();

      setModalOpen(false);
      setModalEvent(null);
      setEditingEventId(null);
      setTempEvent(null);
    } catch (error) {
      console.error("Error saving event:", error);
      // alert("Failed to save event. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!editingEventId) return;
    
    setIsSaving(true);
    try {
      await deleteEventAPI(editingEventId);
      await loadEvents(); // Refresh events after deletion
      
      setModalOpen(false);
      setModalEvent(null);
      setEditingEventId(null);
      setTempEvent(null);
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTaskComplete = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const event = events.find(ev => ev.id === eventId);
    if (!event || event.type !== 'task') return;

    const newCompletedState = !event.completed;
    
    // Optimistically update UI
    setEvents(prevEvents =>
      prevEvents.map(ev =>
        ev.id === eventId ? { ...ev, completed: newCompletedState } : ev
      )
    );

    try {
      // Update in backend
      const dbEvent = eventToDBEvent({
        ...event,
        completed: newCompletedState,
      }, true); // Include id

      await updateEvent({ ...dbEvent, id: eventId } as DBEventType);
    } catch (error) {
      console.error("Error updating task completion:", error);
      // Revert optimistic update on error
      setEvents(prevEvents =>
        prevEvents.map(ev =>
          ev.id === eventId ? { ...ev, completed: !newCompletedState } : ev
        )
      );
      alert("Failed to update task. Please try again.");
    }
  };

  // Drag handlers (move event)
  const onDragStart = (
    e: React.MouseEvent<HTMLDivElement>,
    eventId: string
  ) => {
    if (modalOpen) return;
    e.preventDefault();
    draggingEventId.current = eventId;
    dragStartY.current = e.clientY;
    hasDragged.current = false;

    const event = events.find((ev) => ev.id === eventId);
    dragStartDate.current = event?.start || null;

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  };

  const onDragMove = (e: MouseEvent) => {
    e.preventDefault();
    if (!draggingEventId.current || !dragStartDate.current) return;

    const deltaY = e.clientY - dragStartY.current;
    
    // Mark as dragged if moved more than 5 pixels
    if (Math.abs(deltaY) > 5) {
      hasDragged.current = true;
    }

    const minutesMoved = Math.round((deltaY / SLOT_HEIGHT_PX) * 60);

    let newStart = new Date(dragStartDate.current.getTime());
    newStart.setMinutes(dragStartDate.current.getMinutes() + minutesMoved);

    if (newStart < dayStart) newStart = new Date(dayStart);
    if (newStart >= dayEnd) newStart = new Date(dayEnd.getTime() - 1);

    setEvents((prevEvents) =>
      prevEvents.map((ev) => {
        if (ev.id === draggingEventId.current) {
          const duration = ev.end.getTime() - ev.start.getTime();
          let newEnd = new Date(newStart.getTime() + duration);
          if (newEnd > dayEnd) {
            newEnd = new Date(dayEnd.getTime() - 1);
            newStart = new Date(newEnd.getTime() - duration);
          }
          return { ...ev, start: newStart, end: newEnd };
        }
        return ev;
      })
    );
  };

  const onDragEnd = async (e: MouseEvent) => {
    e.preventDefault();
    const draggedEventId = draggingEventId.current;
    const didDrag = hasDragged.current;
    
    draggingEventId.current = null;
    dragStartDate.current = null;
    hasDragged.current = false;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);

    // If we dragged, save the new position
    if (didDrag && draggedEventId) {
      const event = events.find((ev) => ev.id === draggedEventId);
      if (event) {
        try {
          const dbEvent = eventToDBEvent(event, true); // Include id
          await updateEvent({ ...dbEvent, id: draggedEventId } as DBEventType);
        } catch (error) {
          console.error("Error updating event position:", error);
          alert("Failed to update event position. Refreshing...");
          await loadEvents(); // Reload to revert
        }
      }
    } else if (!didDrag && draggedEventId) {
      // Only open modal if we didn't actually drag
      const event = events.find((ev) => ev.id === draggedEventId);
      if (event) {
        onEventClick(event);
      }
    }
  };

  // Resize handlers (resize event duration)
  const onResizeStart = (
    e: React.MouseEvent<HTMLDivElement>,
    eventId: string
  ) => {
    if (modalOpen) return;
    e.preventDefault();
    e.stopPropagation();
    resizingEventId.current = eventId;
    resizeStartY.current = e.clientY;

    const event = events.find((ev) => ev.id === eventId);
    resizeStartEndDate.current = event?.end || null;

    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeEnd);
  };

  const onResizeMove = (e: MouseEvent) => {
    e.preventDefault();
    if (!resizingEventId.current || !resizeStartEndDate.current) return;

    const deltaY = e.clientY - resizeStartY.current;
    const minutesMoved = Math.round((deltaY / SLOT_HEIGHT_PX) * 60);

    let newEnd = new Date(resizeStartEndDate.current.getTime());
    newEnd.setMinutes(resizeStartEndDate.current.getMinutes() + minutesMoved);

    const event = events.find((ev) => ev.id === resizingEventId.current);
    if (!event) return;

    // Clamp newEnd to be after start + minimum duration
    const minEnd = new Date(event.start.getTime());
    minEnd.setMinutes(minEnd.getMinutes() + MIN_EVENT_DURATION_MINUTES);

    if (newEnd < minEnd) newEnd = minEnd;
    if (newEnd > dayEnd) newEnd = new Date(dayEnd.getTime() - 1);

    setEvents((prevEvents) =>
      prevEvents.map((ev) =>
        ev.id === resizingEventId.current ? { ...ev, end: newEnd } : ev
      )
    );
  };

  const onResizeEnd = async (e: MouseEvent) => {
    e.preventDefault();
    const resizedEventId = resizingEventId.current;
    
    resizingEventId.current = null;
    resizeStartEndDate.current = null;
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeEnd);

    // Save the resized event
    if (resizedEventId) {
      const event = events.find((ev) => ev.id === resizedEventId);
      if (event) {
        try {
          const dbEvent = eventToDBEvent(event, true); // Include id
          await updateEvent({ ...dbEvent, id: resizedEventId } as DBEventType);
        } catch (error) {
          console.error("Error updating event duration:", error);
          alert("Failed to update event duration. Refreshing...");
          await loadEvents(); // Reload to revert
        }
      }
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(today);

  // current-time bar position calculation (same scale as events)
  const quarterSlotPx = SLOT_HEIGHT_PX / 4; // 15-min slot px
  const pixelsPerMinute = quarterSlotPx / 15;
  const minutesSinceStart = (now.getTime() - dayStart.getTime()) / (1000 * 60);
  const currentTopPx = minutesSinceStart * pixelsPerMinute + quarterSlotPx;

  return (
    <div className={styles.calendarContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.timeColumn}></div>
        <div className={styles.gridColumn}>
          <strong>{formattedDate}</strong>
        </div>
      </div>

      {/* Main Grid */}
      <div 
        ref={scrollContainerRef}
        style={{ 
          display: "flex", 
          flexGrow: 1, 
          overflowY: "auto",
          overflowX: "hidden", 
        }}
      >
        {/* Time column */}
        <div className={styles.timeColumn} style={{ flexShrink: 0 }}>
          {slots.map((time, i) => (
            <div
              key={i}
              className={styles.timeSlot}
              style={{ height: SLOT_HEIGHT_PX }}
              aria-label={formatTime(time)}
            >
              {formatTime(time)}
            </div>
          ))}
        </div>

        {/* Grid column */}
        <div
          className={styles.gridColumn}
          style={{ position: "relative", overflowY: "visible" }}
          role="grid"
          aria-label="Day calendar"
        >
          {/* Clickable slots */}
          {Array.from({ length: HOURS_IN_DAY * 4 }).map((_, i) => {
            const isHoveredBlock =
              hoveredSlotIndex !== null && i >= hoveredSlotIndex && i < hoveredSlotIndex + 4;

            return (
              <div
                key={i}
                className={styles.timeSlot}
                style={{
                  height: SLOT_HEIGHT_PX / 4,
                  backgroundColor: isHoveredBlock ? "rgba(93, 150, 207, 0.2)" : "transparent",
                  cursor: "pointer",
                  borderBottom: (i + 1) % 4 === 0 ? "1px solid #5D96CF" : "none",
                  transition: "background-color 0.15s ease",
                }}
                onClick={() => onSlotClick(i)}
                role="gridcell"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSlotClick(i);
                }}
                onMouseEnter={() => setHoveredSlotIndex(i)}
                onMouseLeave={() => setHoveredSlotIndex(null)}
                aria-label={`Select time slot ${formatTime(new Date(dayStart.getTime() + i * 15 * 60 * 1000))}`}
              ></div>
            );
          })}

            {/* Current time indicator bar */}
            {now >= dayStart && now <= dayEnd && (
              <div
                className={styles.currentTimeBar}
                style={{ top: `${currentTopPx}px` }}
                aria-hidden
              >
                <div className={styles.currentTimeDot} />
                <div className={styles.currentTimeLabel}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )}

          {/* Render events */}
          {events.map((event) => {
            const displayEvent = (editingEventId === event.id && tempEvent) ? tempEvent : event;
            const { topPx, heightPx } = getEventPosition(displayEvent, dayStart);
            const priorityColors = getPriorityColor(displayEvent.priority);
            const isTask = displayEvent.type === 'task';
            const isPast = displayEvent.end.getTime() <= now.getTime();

            return (
              <div
                key={event.id}
                className={`${styles.event} ${isTask ? styles.eventTask : ''} ${editingEventId === event.id && tempEvent ? styles.eventEditingTemp : ''} ${isTask && displayEvent.completed ? styles.eventCompleted : ''} ${isPast ? styles.eventPast : ''}`}
                style={{
                  top: `${topPx}px`,
                  height: `${heightPx}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onEventClick(event);
                }}
                aria-label={`${isTask ? 'Task' : 'Event'}: ${displayEvent.title} from ${formatTime(
                  displayEvent.start
                )} to ${formatTime(displayEvent.end)}`}
                onMouseDown={(e) => {
                  if (!modalOpen) onDragStart(e, event.id);
                }}
              >
                {isTask && (
                  <div
                    className={`${styles.taskCheckbox} ${displayEvent.completed ? styles.taskCheckboxChecked : ''}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => toggleTaskComplete(event.id, e)}
                  >
                    {displayEvent.completed && (
                      <span className={styles.taskCheckmark}>✓</span>
                    )}
                  </div>
                )}
                {displayEvent.title}

                {/* Priority badge */}
                <div className={`${styles.priorityBadge} ${displayEvent.priority === 'low' ? styles.priorityLow : displayEvent.priority === 'high' ? styles.priorityHigh : styles.priorityUrgent}`}>
                  {displayEvent.priority}
                </div>

                {/* Resize handle */}
                <div
                  className={styles.eventResizeHandle}
                  onMouseDown={(e) => {
                    if (!modalOpen) onResizeStart(e, event.id);
                  }}
                  aria-label="Resize event duration"
                  role="slider"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    // Optional: support keyboard resizing here
                  }}
                ></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && modalEvent && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={() => {
            setModalOpen(false);
            setModalEvent(null);
            setEditingEventId(null);
            setTempEvent(null);
          }}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="modal-title">{editingEventId ? "Edit Event" : "New Event"}</h2>
            <label htmlFor="title">Title</label>
            <input
              id="title"
              name="title"
              type="text"
              value={modalEvent.title || ""}
              onChange={handleModalChange}
              autoFocus
              disabled={isSaving}
            />
            <label htmlFor="start">Start Time</label>
            <input
              id="start"
              name="start"
              type="time"
              value={
                modalEvent.start ? modalEvent.start.toTimeString().slice(0, 5) : ""
              }
              onChange={handleModalChange}
              disabled={isSaving}
            />
            <label htmlFor="end">End Time</label>
            <input
              id="end"
              name="end"
              type="time"
              value={
                modalEvent.end ? modalEvent.end.toTimeString().slice(0, 5) : ""
              }
              onChange={handleModalChange}
              disabled={isSaving}
            />
            <div>
              <label htmlFor="priority" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Priority</label>
              <select
                id="priority"
                name="priority"
                value={modalEvent.priority || 'low'}
                onChange={handleModalChange}
                className={styles.modalSelect}
                disabled={isSaving}
              >
                <option value="low">Low</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label htmlFor="type" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Type</label>
              <select
                id="type"
                name="type"
                value={modalEvent.type || 'event'}
                onChange={handleModalChange}
                className={styles.modalSelect}
                disabled={isSaving}
              >
                <option value="event">Event</option>
                <option value="task">Task</option>
              </select>
            </div>

            <div className={styles.modalButtons}>
              {editingEventId && (
                <button
                  type="button"
                  onClick={deleteEvent}
                  style={{ backgroundColor: "#f44336" }}
                  disabled={isSaving}
                >
                  {isSaving ? "Deleting..." : "Delete"}
                </button>
              )}
              <button 
                type="button" 
                onClick={() => {
                  setModalOpen(false);
                  setModalEvent(null);
                  setEditingEventId(null);
                  setTempEvent(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button type="button" onClick={saveEvent} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomCalendar;