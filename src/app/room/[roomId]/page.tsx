'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const [isSharing, setIsSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [roomStatus, setRoomStatus] = useState<
    'connecting' | 'joined' | 'error'
  >('connecting');
  const [error, setError] = useState('');
  const [peers, setPeers] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const roomId = decodeURIComponent(params.roomId);

  // Initialize socket and peer connection
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        // Connect to signaling server
        socketRef.current = io(
          process.env.NEXT_PUBLIC_WS_SERVER || 'http://localhost:3001'
        );

        socketRef.current.on('connect', () => {
          socketRef.current?.emit('join-room', roomId);
        });

        socketRef.current.on('room-joined', () => {
          setRoomStatus('joined');
        });

        socketRef.current.on('room-error', (data: { error: string }) => {
          setError(data.error);
          setRoomStatus('error');
        });

        socketRef.current.on('new-peer', (data: { peerId: string }) => {
          setPeers((prev) => [...prev, data.peerId]);
        });

        socketRef.current.on('disconnect', () => {
          setError('Disconnected from server');
          setRoomStatus('error');
        });

        // Initialize WebRTC peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // Add your TURN servers here if needed
          ],
        });
        peerConnectionRef.current = pc;

        // ICE candidate handling
        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            peers.forEach((peerId) => {
              socketRef.current?.emit('ice-candidate', {
                roomId,
                candidate: event.candidate,
                targetPeerId: peerId,
              });
            });
          }
        };

        // Remote stream handling
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams.length > 0) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setRemoteStream(event.streams[0]);
          }
        };

        // Handle signaling messages
        socketRef.current.on(
          'offer',
          async (data: {
            offer: RTCSessionDescriptionInit;
            senderId: string;
          }) => {
            if (!peerConnectionRef.current) return;

            await pc.setRemoteDescription(
              new RTCSessionDescription(data.offer)
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current?.emit('answer', {
              roomId,
              answer,
              targetPeerId: data.senderId,
            });
          }
        );

        socketRef.current.on(
          'answer',
          async (data: { answer: RTCSessionDescriptionInit }) => {
            if (!peerConnectionRef.current) return;
            await pc.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
          }
        );

        socketRef.current.on(
          'ice-candidate',
          async (data: { candidate: RTCIceCandidate }) => {
            if (!peerConnectionRef.current) return;
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        );
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize connection');
        setRoomStatus('error');
      }
    };

    initializeConnection();

    return () => {
      // Cleanup
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId]);

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setLocalStream(stream);
      setIsSharing(true);

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        peerConnectionRef.current?.addTrack(track, stream);
      });

      // Create offer for each peer
      if (peers.length > 0 && peerConnectionRef.current) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        peers.forEach((peerId) => {
          socketRef.current?.emit('offer', {
            roomId,
            offer,
            targetPeerId: peerId,
          });
        });
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
      setError('Failed to share screen');
    }
  };

  const stopSharing = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    setIsSharing(false);
  };

  if (roomStatus === 'connecting') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-xl'>Connecting to room {roomId}...</p>
        </div>
      </div>
    );
  }

  if (roomStatus === 'error') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center bg-red-100 p-8 rounded-lg max-w-md'>
          <h2 className='text-2xl font-bold text-red-600 mb-4'>Error</h2>
          <p className='text-red-800 mb-4'>{error || 'Failed to join room'}</p>
          <a
            href='/'
            className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition'
          >
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-100 p-4'>
      <header className='mb-6'>
        <h1 className='text-2xl font-bold'>Room: {roomId}</h1>
        <p className='text-gray-600'>
          {peers.length > 0
            ? `${peers.length} peer(s) connected`
            : 'Waiting for peers...'}
        </p>
      </header>

      <div className='flex flex-col md:flex-row gap-6'>
        {/* Local Screen */}
        <div className='flex-1 bg-white p-4 rounded-lg shadow'>
          <h2 className='text-xl font-semibold mb-4'>Your Screen</h2>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            className='w-full bg-black rounded-lg aspect-video'
          />
          <div className='mt-4 flex justify-center'>
            {!isSharing ? (
              <button
                onClick={startSharing}
                className='bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition'
              >
                Start Sharing
              </button>
            ) : (
              <button
                onClick={stopSharing}
                className='bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition'
              >
                Stop Sharing
              </button>
            )}
          </div>
        </div>

        {/* Remote Screen */}
        <div className='flex-1 bg-white p-4 rounded-lg shadow'>
          <h2 className='text-xl font-semibold mb-4'>Remote Screen</h2>
          <video
            ref={remoteVideoRef}
            autoPlay
            className='w-full bg-black rounded-lg aspect-video'
          />
          {!remoteStream && (
            <div className='mt-4 text-center text-gray-500'>
              Waiting for remote stream...
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className='mt-6 p-4 bg-red-100 text-red-800 rounded-lg'>
          {error}
        </div>
      )}
    </div>
  );
}
