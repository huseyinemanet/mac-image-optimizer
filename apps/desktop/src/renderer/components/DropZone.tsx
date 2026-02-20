import React from 'react';
import type { DragEventHandler } from 'react';
import { motion } from 'motion/react';

interface DropZoneProps {
  onDrop: DragEventHandler<HTMLDivElement>;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  isDragActive: boolean;
}

export function DropZone({ onDrop, onDragEnter, onDragLeave, isDragActive }: DropZoneProps): React.JSX.Element {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="grid h-full place-items-center rounded-lg transition-colors"
      style={{
        border: `1.5px dashed ${isDragActive ? 'var(--macos-accent)' : 'var(--macos-separator)'}`,
        background: isDragActive ? 'var(--macos-selection)' : 'transparent'
      }}
    >
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_8_14)">
              <mask id="mask0_8_14" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
                <path d="M48 0H0V48H48V0Z" fill="white" />
                <path d="M13 19.6989C13 17.6257 13 16.5891 13.3073 15.6662C13.5791 14.8498 14.0234 14.1015 14.6099 13.4719C15.273 12.7602 16.183 12.2638 18.003 11.2711L25.5354 7.16253C28.6528 5.46213 30.2114 4.61191 31.4856 4.76775C32.5974 4.90373 33.6014 5.49965 34.253 6.41063C35 7.45455 35 9.23005 35 12.7811V28.3012C35 30.3744 35 31.4108 34.6926 32.3338C34.4208 33.1502 33.9766 33.8986 33.39 34.528C32.727 35.2398 31.817 35.7362 29.997 36.729L22.4646 40.8374C19.3472 42.5378 17.7885 43.388 16.5144 43.2322C15.4026 43.0962 14.3987 42.5004 13.7469 41.5894C13 40.5454 13 38.77 13 35.219V19.6989Z" fill="black" />
              </mask>
              <g mask="url(#mask0_8_14)">
                <path d="M2 16.6989C2 14.6257 2 13.5891 2.3073 12.6662C2.57914 11.8498 3.0234 11.1015 3.60992 10.4719C4.27296 9.76019 5.18298 9.26382 7.00302 8.27108L14.5353 4.16254C17.6528 2.46214 19.2115 1.61192 20.4856 1.76775C21.5974 1.90373 22.6014 2.49966 23.253 3.41064C24 4.45456 24 6.23006 24 9.78106V25.3012C24 27.3744 24 28.4108 23.6926 29.3338C23.4208 30.1502 22.9766 30.8986 22.39 31.528C21.727 32.2398 20.817 32.7362 18.997 33.729L11.4647 37.8374C8.34724 39.5378 6.78854 40.388 5.51442 40.2322C4.40258 40.0962 3.3987 39.5004 2.74692 38.5894C2 37.5454 2 35.77 2 32.219V16.6989Z" fill="url(#paint0_linear_8_14)" />
              </g>
              <mask id="mask1_8_14" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="13" y="4" width="22" height="40">
                <path d="M13 19.6989C13 17.6257 13 16.5891 13.3073 15.6662C13.5791 14.8498 14.0234 14.1015 14.6099 13.4719C15.273 12.7602 16.183 12.2638 18.003 11.2711L25.5354 7.16253C28.6528 5.46213 30.2114 4.61191 31.4856 4.76775C32.5974 4.90373 33.6014 5.49965 34.253 6.41063C35 7.45455 35 9.23005 35 12.7811V28.3012C35 30.3744 35 31.4108 34.6926 32.3338C34.4208 33.1502 33.9766 33.8986 33.39 34.528C32.727 35.2398 31.817 35.7362 29.997 36.729L22.4646 40.8374C19.3472 42.5378 17.7885 43.388 16.5144 43.2322C15.4026 43.0962 14.3987 42.5004 13.7469 41.5894C13 40.5454 13 38.77 13 35.219V19.6989Z" fill="white" />
              </mask>
              <g mask="url(#mask1_8_14)">
                <g filter="url(#filter0_f_8_14)">
                  <path d="M2 16.6989C2 14.6257 2 13.5891 2.3073 12.6662C2.57914 11.8498 3.0234 11.1015 3.60992 10.4719C4.27296 9.76019 5.18298 9.26382 7.00302 8.27108L14.5353 4.16254C17.6528 2.46214 19.2115 1.61192 20.4856 1.76775C21.5974 1.90373 22.6014 2.49966 23.253 3.41064C24 4.45456 24 6.23006 24 9.78106V25.3012C24 27.3744 24 28.4108 23.6926 29.3338C23.4208 30.1502 22.9766 30.8986 22.39 31.528C21.727 32.2398 20.817 32.7362 18.997 33.729L11.4647 37.8374C8.34724 39.5378 6.78854 40.388 5.51442 40.2322C4.40258 40.0962 3.3987 39.5004 2.74692 38.5894C2 37.5454 2 35.77 2 32.219V16.6989Z" fill="url(#paint1_linear_8_14)" />
                </g>
              </g>
              <path d="M13 19.6989C13 17.6257 13 16.5891 13.3073 15.6662C13.5791 14.8498 14.0234 14.1015 14.6099 13.4719C15.273 12.7602 16.183 12.2638 18.003 11.2711L25.5354 7.16253C28.6528 5.46213 30.2114 4.61191 31.4856 4.76775C32.5974 4.90373 33.6014 5.49965 34.253 6.41063C35 7.45455 35 9.23005 35 12.7811V28.3012C35 30.3744 35 31.4108 34.6926 32.3338C34.4208 33.1502 33.9766 33.8986 33.39 34.528C32.727 35.2398 31.817 35.7362 29.997 36.729L22.4646 40.8374C19.3472 42.5378 17.7885 43.388 16.5144 43.2322C15.4026 43.0962 14.3987 42.5004 13.7469 41.5894C13 40.5454 13 38.77 13 35.219V19.6989Z" fill="url(#paint2_linear_8_14)" />
              <path d="M31.4864 4.76695C32.5978 4.90309 33.6022 5.49899 34.254 6.40953C35.0008 7.45341 35 9.23009 35 12.7806V28.3002C35 30.373 35.0004 31.4106 34.6934 32.3334L34.582 32.6362C34.307 33.3344 33.9034 33.9762 33.3906 34.5268L33.129 34.7864C32.6898 35.1862 32.1308 35.5386 31.3144 35.9994H28.2012L29.2792 35.4114C31.1902 34.3692 31.8352 33.9966 32.293 33.5052C32.7326 33.0332 33.0658 32.4708 33.2696 31.8588C33.4814 31.2218 33.5 30.4764 33.5 28.3002V12.7806C33.5 10.9761 33.4976 9.72573 33.4122 8.79235C33.326 7.85389 33.1706 7.47457 33.0332 7.28259C32.6258 6.71353 31.9974 6.34019 31.3028 6.25523C31.0682 6.22681 30.661 6.27241 29.7968 6.64587C28.9366 7.01767 27.838 7.61385 26.254 8.47789L18.7207 12.5873C16.8099 13.6295 16.1648 14.0023 15.707 14.4935C15.2673 14.9655 14.9344 15.5279 14.7305 16.14C14.5184 16.7771 14.5 17.5222 14.5 19.6986V35.2182C14.5 35.5994 14.5029 35.9564 14.5039 36.2904C13.9257 36.5238 13.417 36.89 13.0098 37.349C13.0014 36.72 13 36.0134 13 35.2182V19.6986C13 17.6258 12.9994 16.5882 13.3066 15.6654C13.5445 14.9512 13.9148 14.2883 14.3965 13.7123L14.6094 13.472C15.1067 12.9383 15.7439 12.5248 16.7988 11.933L18.0039 11.2709L25.5352 7.16149C28.6524 5.46121 30.2122 4.61117 31.4864 4.76695Z" fill="url(#paint3_linear_8_14)" />
              <path d="M24 22.6988C24 20.6256 24 19.5891 24.3074 18.6662C24.5792 17.8498 25.0234 17.1015 25.61 16.4719C26.273 15.7602 27.183 15.2638 29.003 14.2711L36.5354 10.1625C39.6528 8.46213 41.2114 7.61191 42.4856 7.76775C43.5974 7.90373 44.6014 8.49965 45.253 9.41063C46 10.4546 46 12.2301 46 15.7811V31.3012C46 33.3744 46 34.4108 45.6926 35.3338C45.4208 36.1502 44.9766 36.8986 44.39 37.528C43.727 38.2398 42.817 38.7362 40.997 39.729L33.4646 43.8374C30.3472 45.5378 28.7886 46.388 27.5144 46.2322C26.4026 46.0962 25.3986 45.5004 24.747 44.5894C24 43.5454 24 41.77 24 38.219V22.6988Z" fill="url(#paint4_linear_8_14)" />
            </g>
            <defs>
              <filter id="filter0_f_8_14" x="-6" y="-6.25043" width="38" height="54.5008" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                <feGaussianBlur stdDeviation="4" result="effect1_foregroundBlur_8_14" />
              </filter>
              <linearGradient id="paint0_linear_8_14" x1="13" y1="-1" x2="13" y2="43" gradientUnits="userSpaceOnUse">
                <stop stopColor="#575757" />
                <stop offset="1" stopColor="#151515" />
              </linearGradient>
              <linearGradient id="paint1_linear_8_14" x1="13" y1="-1" x2="13" y2="43" gradientUnits="userSpaceOnUse">
                <stop stopColor="#575757" />
                <stop offset="1" stopColor="#151515" />
              </linearGradient>
              <linearGradient id="paint2_linear_8_14" x1="24" y1="1.99999" x2="24" y2="46" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E3E3E5" stopOpacity="0.6" />
                <stop offset="1" stopColor="#BBBBC0" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="paint3_linear_8_14" x1="24" y1="4.74999" x2="24" y2="35" gradientUnits="userSpaceOnUse">
                <stop stopColor="white" />
                <stop offset="1" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="paint4_linear_8_14" x1="35" y1="4.99999" x2="35" y2="49" gradientUnits="userSpaceOnUse">
                <stop stopColor="#575757" />
                <stop offset="1" stopColor="#151515" />
              </linearGradient>
              <clipPath id="clip0_8_14">
                <rect width="48" height="48" fill="white" />
              </clipPath>
            </defs>
          </svg>
        </div>
        <h2 className="dropzone-shine-message mx-auto" aria-label="Drop a folder or images here">
          <span className="dropzone-shine-message-base">Drop a folder or images here</span>
          <motion.span
            className="dropzone-shine-message-shine"
            initial={{ backgroundPosition: '220% 0%' }}
            animate={{ backgroundPosition: ['220% 0%', '-180% 0%'] }}
            transition={{ duration: 2.2, ease: 'linear', repeat: Infinity, repeatDelay: 0.6 }}
            aria-hidden="true"
          >
            Drop a folder or images here
          </motion.span>
        </h2>
      </div>
    </div>
  );
}
