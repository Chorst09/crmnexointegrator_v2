import { NextResponse } from 'next/server';

// Supported proposal types
const SUPPORTED_PROPOSAL_TYPES = [
  {
    id: 'FIBER',
    name: 'Fiber Internet',
    description: 'Fiber optic internet connection proposals'
  },
  {
    id: 'VM',
    name: 'Virtual Machines',
    description: 'Virtual machine hosting and cloud service proposals'
  },
  {
    id: 'RADIO',
    name: 'Radio Internet',
    description: 'Radio-based internet connection proposals'
  },
  {
    id: 'PABX',
    name: 'PABX SIP',
    description: 'PABX SIP telephony system proposals'
  },
  {
    id: 'MAN',
    name: 'Metropolitan Area Network',
    description: 'Metropolitan area network infrastructure proposals'
  },
  {
    id: 'GENERAL',
    name: 'General',
    description: 'General or miscellaneous proposals'
  }
] as const;

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({
      types: SUPPORTED_PROPOSAL_TYPES,
      count: SUPPORTED_PROPOSAL_TYPES.length
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching proposal types:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to fetch proposal types'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method Not Allowed', message: 'POST method is not supported for this endpoint' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method Not Allowed', message: 'PUT method is not supported for this endpoint' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method Not Allowed', message: 'DELETE method is not supported for this endpoint' },
    { status: 405 }
  );
}