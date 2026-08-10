import React from 'react';
import ImageCropModal from './ImageCropModal';

export default function PhotoCropModal(props) {
  return (
    <ImageCropModal
      {...props}
      title="Crop profile photo"
      subtitle="Drag the image, move the crop area, or grab any corner to frame your photo exactly how you want."
      shape="rectangle"
      maxStageW={300}
      maxStageH={300}
      maxOutputLongSide={600}
      outputQuality={0.9}
      outputName="profile.jpg"
    />
  );
}
