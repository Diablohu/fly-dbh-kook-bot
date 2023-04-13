export type MessageSource = 'discord' | 'twitter' | 'youtube';

export type SizeType = 'xs' | 'sm' | 'md' | 'lg';
export type ModuleType =
    | {
          type:
              | 'section'
              | 'context'
              | 'kmarkdown'
              | 'plain-text'
              | 'image'
              | 'image-group'
              | 'container'
              | 'video'
              | 'divider';
          src?: string;
          content?: string;
          elements?: ModuleType[];
          title?: string;
          text?: ModuleType;
          size?: SizeType;
          mode?: 'left' | 'right';
          accessory?: ModuleType;
      }
    | undefined;
export type MessageType = {
    type: 'card';
    theme?: 'primary' | 'warning' | 'danger' | 'info' | 'none' | 'secondary';
    color?: string;
    size?: SizeType;
    modules: ModuleType[];
};
