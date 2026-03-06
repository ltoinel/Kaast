/**
 * useTimelineDrag — Manages clip drag-and-drop on the timeline.
 *
 * Handles drag start, drag over (with grid snapping), drag leave, and drop
 * events for repositioning clips on audio/video tracks.
 */
import { useState, useCallback, useRef } from "react";

interface UseTimelineDragOptions {
  zoom: number;
  snapToGrid: (time: number) => number;
  onMoveClip?: (clipId: string, type: "audio" | "video", newStartTime: number) => void;
}

export function useTimelineDrag({ zoom, snapToGrid, onMoveClip }: UseTimelineDragOptions) {
  const [dragOverTrack, setDragOverTrack] = useState<"audio" | "video" | null>(null);
  const [dragSnapX, setDragSnapX] = useState<number | null>(null);
  const dragOffsetRef = useRef<number>(0);

  const handleDragStart = useCallback((e: React.DragEvent, clipId: string, type: "audio" | "video") => {
    e.dataTransfer.setData("application/clip-id", clipId);
    e.dataTransfer.setData("application/clip-type", type);
    e.dataTransfer.effectAllowed = "move";
    const clipRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffsetRef.current = e.clientX - clipRect.left;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, trackType: "audio" | "video") => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTrack(trackType);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffsetRef.current;
    const rawTime = Math.max(0, x / zoom);
    const snappedTime = snapToGrid(rawTime);
    setDragSnapX(snappedTime * zoom);
  }, [zoom, snapToGrid]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverTrack(null);
      setDragSnapX(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, trackType: "audio" | "video") => {
    e.preventDefault();
    setDragOverTrack(null);
    setDragSnapX(null);

    const clipId = e.dataTransfer.getData("application/clip-id");
    const clipType = e.dataTransfer.getData("application/clip-type") as "audio" | "video";

    if (!clipId || !clipType || clipType !== trackType) return;
    if (!onMoveClip) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffsetRef.current;
    const rawTime = Math.max(0, x / zoom);
    const snappedTime = snapToGrid(rawTime);

    onMoveClip(clipId, clipType, snappedTime);
  }, [zoom, snapToGrid, onMoveClip]);

  return {
    dragOverTrack,
    dragSnapX,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
