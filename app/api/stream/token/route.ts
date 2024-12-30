import { StreamChat } from 'stream-chat';
import { NextResponse } from 'next/server';

const serverClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_KEY!,
  process.env.STREAM_CHAT_SECRET!
);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const token = serverClient.createToken(userId);
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Could not generate token' },
      { status: 500 }
    );
  }
}