import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Listar todos os site surveys
export async function GET() {
  try {
    const surveys = await prisma.siteSurvey.findMany({
      orderBy: {
        created_at: 'desc'
      }
    });

    // Transformar para o formato esperado pelo frontend
    const formattedSurveys = surveys.map(survey => ({
      id: survey.id,
      customerName: survey.customer_name,
      address: survey.address,
      surveyType: survey.survey_type,
      details: survey.details as Record<string, string>,
      createdAt: survey.created_at.toISOString()
    }));

    return NextResponse.json(formattedSurveys);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surveys' },
      { status: 500 }
    );
  }
}

// POST - Criar novo site survey
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, address, surveyType, details } = body;

    const survey = await prisma.siteSurvey.create({
      data: {
        customer_name: customerName,
        address,
        survey_type: surveyType,
        details: details || {}
      }
    });

    return NextResponse.json({
      id: survey.id,
      customerName: survey.customer_name,
      address: survey.address,
      surveyType: survey.survey_type,
      details: survey.details as Record<string, string>,
      createdAt: survey.created_at.toISOString()
    });
  } catch (error) {
    console.error('Error creating survey:', error);
    return NextResponse.json(
      { error: 'Failed to create survey' },
      { status: 500 }
    );
  }
}
