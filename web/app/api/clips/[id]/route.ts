import { NextRequest, NextResponse } from 'next/server';
import { getClipById, deleteClip, saveClip, toggleFavorite } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clip = getClipById(params.id);
    if (!clip) {
      return NextResponse.json({ success: false, error: 'Clip not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, clip });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = deleteClip(params.id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Clip not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    if (body.action === 'toggleFavorite') {
      const updated = toggleFavorite(params.id);
      return NextResponse.json({ success: true, clip: updated });
    }

    const existing = getClipById(params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Clip not found' }, { status: 404 });
    }

    const updated = saveClip({ ...existing, ...body });
    return NextResponse.json({ success: true, clip: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
