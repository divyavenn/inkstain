'use client';

import styled, { css } from 'styled-components';

const SURFACE_TEXTURE = css`
  background-color: #fcfcfc;
  background-image: url('/bg-texture.png');
  background-repeat: repeat;
  background-size: 100px 100px;
`;

const Wrapper = styled.div`
  width: 500px;
  height: 300px;
  ${SURFACE_TEXTURE}
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
`;

const ContentRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0;
  position: relative;
  -webkit-mask-image:
    linear-gradient(to right, black 40%, transparent 80%),
    linear-gradient(to bottom, black 40%, transparent);
  -webkit-mask-composite: destination-in;
  mask-image:
    linear-gradient(to right, black 40%, transparent 80%),
    linear-gradient(to bottom, black 40%, transparent);
  mask-composite: intersect;
`;

const TextColumn = styled.div`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 2rem;
  font-weight: 400;
  color: #1a1a1a;
  line-height: 1.4;
  max-width: 400px;
  user-select: none;
  white-space: normal;

  mark {
    background: linear-gradient(
      to right,
      rgba(253, 224, 71, 0.14),
      rgba(253, 224, 71, 0.45) 4%,
      rgba(253, 224, 71, 0.25)
    );
    border-radius: 0.8em 0.3em;
    padding: 0.1em 0.4em;
    margin: 0 -0.4em;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    color: inherit;
    cursor: pointer;
  }
`;

const MarginColumn = styled.div`
  position: relative;
  width: 60px;
  flex-shrink: 0;
  align-self: stretch;
  margin-left:50px;
`;

/* eslint-disable-next-line @next/next/no-img-element */
const FaceImg = styled.img`
  position: absolute;
  width: 60px;
  height: 60px;
  filter: brightness(0) saturate(100%) invert(25%) sepia(80%) saturate(600%) hue-rotate(197deg) brightness(95%) contrast(95%);
`;

export default function TilePage() {
  return (
    <Wrapper id="tile">
      <ContentRow>
        <MarginColumn>
          <FaceImg
            src="/good1.svg"
            alt=""
            style={{
              top: '-2px',
              left: '-10px',
              transform: 'rotate(-8deg)',
            }}
          />
        </MarginColumn>
        <TextColumn>
          <mark>InkLink</mark> makes getting feedback and versioning as easy as sharing a link. 
        </TextColumn>
      </ContentRow>
    </Wrapper>
  );
}
