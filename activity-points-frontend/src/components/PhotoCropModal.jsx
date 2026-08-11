import React from 'react';
import ImageCropModal from './ImageCropModal';

export default function PhotoCropModal(props) {
  return (
    <ImageCropModal
      {...props}
      busy={props.busy ?? props.uploading ?? false}
      title="Crop profile photo"
      subtitle="Drag or zoom your photo to fit the frame. Every profile photo is saved in the same fixed square, so photos stay consistent across the app."
      shape="rectangle"
      aspectRatio={1}
      maxStageW={300}
      maxStageH={300}
      outputSize={480}
      outputQuality={0.9}
      outputName="profile.jpg"
    />
  );
}
