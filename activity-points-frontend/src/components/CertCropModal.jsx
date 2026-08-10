import React from 'react';
import ImageCropModal from './ImageCropModal';

export default function CertCropModal(props) {
  return (
    <ImageCropModal
      {...props}
      title="Crop certificate"
      subtitle="Drag the image, move the crop area, or grab any corner to keep exactly the part of the certificate you need."
      shape="rectangle"
      maxStageW={320}
      maxStageH={420}
      maxOutputLongSide={1600}
      outputQuality={0.92}
      outputName="certificate.jpg"
    />
  );
}
