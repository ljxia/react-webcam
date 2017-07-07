import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { findDOMNode } from 'react-dom';

function hasGetUserMedia() {
  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

export default class Webcam extends Component {
  static defaultProps = {
    audio: true,
    className: '',
    height: 480,
    mirror: false,
    rotate: '',
    muted: false,
    onUserMedia: () => {},
    screenshotFormat: 'image/webp',
    width: 640,
    constraints: undefined
  };

  static propTypes = {
    audio: PropTypes.bool,
    muted: PropTypes.bool,
    onUserMedia: PropTypes.func,
    height: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
    ]),
    width: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
    ]),
    screenshotFormat: PropTypes.oneOf([
      'image/webp',
      'image/png',
      'image/jpeg',
    ]),
    style: PropTypes.object,
    className: PropTypes.string,
    audioSource: PropTypes.string,
    videoSource: PropTypes.string,
  };

  static mountedInstances = [];

  static userMediaRequested = false;

  constructor() {
    super();
    this.state = {
      hasUserMedia: false
    };
  }

  componentDidMount() {
    if (!hasGetUserMedia()) return;

    Webcam.mountedInstances.push(this);

    if (!this.state.hasUserMedia && !Webcam.userMediaRequested) {
      this.requestUserMedia();
    }
  }

  componentWillUnmount() {
    const index = Webcam.mountedInstances.indexOf(this);
    Webcam.mountedInstances.splice(index, 1);

    if (Webcam.mountedInstances.length === 0 && this.state.hasUserMedia) {
      if (this.stream.stop) {
        this.stream.stop();
      } else {
        if (this.stream.getVideoTracks) {
          this.stream.getVideoTracks().map(track => track.stop());
        }
        if (this.stream.getAudioTracks) {
          this.stream.getAudioTracks().map(track => track.stop());
        }
      }
      Webcam.userMediaRequested = false;
      window.URL.revokeObjectURL(this.state.src);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.rotate !== this.props.rotate) {
      this.initializeCanvas(nextProps.rotate);
    }
  }

  getScreenshot() {
    if (!this.state.hasUserMedia) return null;

    const canvas = this.getCanvas();
    return canvas.toDataURL(this.props.screenshotFormat);
  }

  getCanvas() {
    if (!this.state.hasUserMedia) return null;

    return this.canvas;
  }

  requestUserMedia() {
    navigator.getUserMedia = navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia;

    const applyConstraints = (constraints) => {
      navigator.getUserMedia(constraints, (stream) => {
        Webcam.mountedInstances.forEach(instance => instance.handleUserMedia(null, stream));
      }, (e) => {
        Webcam.mountedInstances.forEach(instance => instance.handleUserMedia(e));
      });
    }

    const sourceSelected = (audioSource, videoSource) => {
      const constraints = {
        video: {
          optional: [{ sourceId: videoSource }],
        },
      };

      if (this.props.audio) {
        constraints.audio = {
          optional: [{ sourceId: audioSource }],
        };
      }

      applyConstraints(constraints);
    };

    if (this.props.constraints) {
      applyConstraints(this.props.constraints);
    } else if (this.props.audioSource && this.props.videoSource) {
      sourceSelected(this.props.audioSource, this.props.videoSource);
    } else if ('mediaDevices' in navigator) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        let audioSource = null;
        let videoSource = null;

        devices.forEach((device) => {
          if (device.kind === 'audioinput') {
            audioSource = device.id;
          } else if (device.kind === 'videoinput') {
            videoSource = device.id;
          }
        });

        sourceSelected(audioSource, videoSource);
      })
        .catch((error) => {
          console.log(`${error.name}: ${error.message}`); // eslint-disable-line no-console
        });
    } else {
      MediaStreamTrack.getSources((sources) => {
        let audioSource = null;
        let videoSource = null;

        sources.forEach((source) => {
          if (source.kind === 'audioinput') {
            audioSource = source.id;
          } else if (source.kind === 'videoinput') {
            videoSource = source.id;
          }
        });

        sourceSelected(audioSource, videoSource);
      });
    }

    Webcam.userMediaRequested = true;
  }

  handleUserMedia(error, stream) {
    if (error) {
      this.setState({
        hasUserMedia: false,
      });

      return;
    }

    const src = window.URL.createObjectURL(stream);

    this.stream = stream;
    this.setState({
      hasUserMedia: true,
      src,
    });

    this.props.onUserMedia();


    this.video.addEventListener('canplay', (e) => {
      this.initializeCanvas(this.props.rotate);
    });

    this.video.addEventListener('play', (e) => {
      this.drawLoop = setInterval(() => {
        if (!this.video) {
          clearInterval(this.drawLoop);
          return;
        }
        if (this.video.paused || this.video.ended) {
          clearInterval(this.drawLoop);
          return;
        }
        const cxt = this.canvas.getContext('2d');

        cxt.save();

        if (this.props.mirror) {
          cxt.translate(this.canvas.width, 0);
          cxt.scale(-1, 1);
        }

        if (this.props.rotate === 'left') {
          cxt.rotate(-1 * (Math.PI / 180) * 90);
          cxt.translate(-this.video.videoWidth, 0);
        }
        else if (this.props.rotate === 'right') {
          cxt.rotate((Math.PI / 180) * 90);
          cxt.translate(0, -this.video.videoHeight);
        }

        cxt.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);

        cxt.restore();
      }, 33)
    });
  }

  initializeCanvas(rotate) {
    if (rotate === '') {
      this.canvas.setAttribute('width', this.video.videoWidth);
      this.canvas.setAttribute('height', this.video.videoHeight);
    }
    else {
      this.canvas.setAttribute('width', this.video.videoHeight);
      this.canvas.setAttribute('height', this.video.videoWidth);
    }
  }

  renderCanvas() {
    return (
      <canvas
        key="canvas"
        ref={(node) => {this.canvas = node;}}
      ></canvas>
    )
  }
  render() {
    return (
      <div className='webcam' style={this.props.style}>
        {this.renderCanvas()}
        <video
          autoPlay
          key="video"
          ref={(node) => {this.video = node;}}
          src={this.state.src}
          muted={this.props.muted}
          className={this.props.className}
          style={{visibility: 'hidden', position: 'absolute', left: 0}}
        />
      </div>
    );
  }
}
