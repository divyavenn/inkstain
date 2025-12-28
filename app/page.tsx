'use client';

import Link from 'next/link';
import styled from 'styled-components';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
`;

const Card = styled.div`
  background: white;
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 1rem;
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: #666;
  margin-bottom: 2rem;
  line-height: 1.6;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Button = styled(Link)`
  padding: 1rem 2rem;
  background: #1a1a1a;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s ease;
  display: block;

  &:hover {
    background: #333;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

const SecondaryButton = styled(Button)`
  background: transparent;
  color: #1a1a1a;
  border: 2px solid #1a1a1a;

  &:hover {
    background: #f5f5f5;
    border-color: #333;
  }
`;

export default function Home() {
  return (
    <Container>
      <Card>
        <Title>📚 BookBeta</Title>
        <Subtitle>
          A minimal, open-source platform for collecting feedback on your writing.
          Perfect for authors seeking beta reader insights.
        </Subtitle>
        <ButtonGroup>
          <Button href="/read">Read & Give Feedback</Button>
          <SecondaryButton href="/admin">Author Dashboard</SecondaryButton>
        </ButtonGroup>
      </Card>
    </Container>
  );
}
