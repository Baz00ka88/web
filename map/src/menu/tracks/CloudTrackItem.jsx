import AppContext, { OBJECT_TYPE_CLOUD_TRACK } from '../../context/AppContext';
import {
    Alert,
    Divider,
    IconButton,
    LinearProgress,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import Utils, { toHHMMSS } from '../../util/Utils';
import TrackInfo from './TrackInfo';
import TracksManager, { isEmptyTrack } from '../../manager/track/TracksManager';
import _ from 'lodash';
import { useWindowSize } from '../../util/hooks/useWindowSize';
import { ReactComponent as TrackIcon } from '../../assets/icons/ic_action_polygom_dark.svg';
import { ReactComponent as MenuIcon } from '../../assets/icons/ic_overflow_menu_white.svg';
import { ReactComponent as MenuIconHover } from '../../assets/icons/ic_overflow_menu_with_background.svg';
import styles from '../trackfavmenu.module.css';
import TrackActions from '../actions/TrackActions';
import ActionsMenu from '../actions/ActionsMenu';
import MenuItemsTitle from '../components/MenuItemsTitle';
import { deleteTrackFromMap } from '../../manager/track/DeleteTrackManager';

const DEFAULT_DIST = 0;
const DEFAULT_TIME = '0:00';

export default function CloudTrackItem({ file, customIcon = null, visible = null, isLastItem }) {
    const ctx = useContext(AppContext);

    const [, , mobile] = useWindowSize();

    const [loadingTrack, setLoadingTrack] = useState(false);
    const [error, setError] = useState('');
    const [hoverIconInfo, setHoverIconInfo] = useState(false);
    const [showTrack, setShowTrack] = useState(false);
    const [openActions, setOpenActions] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const anchorEl = useRef(null);

    const info = useMemo(() => <TrackInfo file={file} />, [file]);

    const dist = getDist(file);
    const time = getTime(file);
    const wptPoints = getWptPoints(file);

    const [displayTrack, setDisplayTrack] = useState(null); // null -> true/false -> null

    function getDist(file) {
        let f = file.details ? file.details : file;
        return f?.analysis?.totalDistance ? (f?.analysis?.totalDistance / 1000).toFixed(2) : DEFAULT_DIST;
    }

    function getTime(file) {
        let f = file.details ? file.details : file;
        return f?.analysis?.timeMoving ? toHHMMSS(f?.analysis?.timeMoving) : DEFAULT_TIME;
    }

    function getWptPoints(file) {
        let f = file.details ? file.details : file;
        return f?.analysis?.wptPoints ? f?.analysis?.wptPoints : null;
    }

    async function processDisplayTrack({ visible, setLoading }) {
        if (!visible) {
            deleteTrackFromMap(ctx, file);
            setLoading(false);
        } else {
            await addTrackToMap(setLoading);
        }
    }

    useEffect(() => {
        if (displayTrack === true || displayTrack === false) {
            processDisplayTrack({ setLoading: setLoadingTrack, visible: displayTrack });
            setDisplayTrack(null);
        }
    }, [displayTrack]);

    useEffect(() => {
        showTrack && addTrackToMap(setLoadingTrack);
    }, [showTrack]);

    async function addTrackToMap(setProgressVisible) {
        // cleanup edited localTrack
        if (ctx.createTrack?.enable && ctx.selectedGpxFile) {
            ctx.setCreateTrack({
                enable: false,
                closePrev: {
                    file: _.cloneDeep(ctx.selectedGpxFile),
                },
            });
        }
        // Watch out for file.url because this component was called using different data sources.
        // CloudTrackGroup uses ctx.tracksGroups (no-url) but VisibleGroup uses ctx.gpxFiles (url exists)
        if (ctx.gpxFiles[file.name]?.url) {
            // if (file.name !== ctx.selectedGpxFile.name) { ...
            ctx.setUpdateInfoBlock(true);
            ctx.setCurrentObjectType(OBJECT_TYPE_CLOUD_TRACK);
            ctx.setSelectedGpxFile({ ...ctx.gpxFiles[file.name], zoom: true, cloudRedrawWpts: true });
            if (file.addFromVisibleTracks) {
                file.addFromVisibleTracks = false;
                ctx.mutateGpxFiles((o) => (o[file.name] = file));
            }
        } else {
            setProgressVisible(true);
            const URL = `${process.env.REACT_APP_USER_API_SITE}/mapapi/download-file`;
            const qs = `?type=${encodeURIComponent(file.type)}&name=${encodeURIComponent(file.name)}`;
            const oneGpxFile = {
                url: URL + qs,
                clienttimems: file.clienttimems,
                updatetimems: file.updatetimems,
                name: file.name,
                type: 'GPX',
            };
            const f = await Utils.getFileData(oneGpxFile);
            const gpxfile = new File([f], file.name, {
                type: 'text/plain',
            });
            const track = await TracksManager.getTrackData(gpxfile);
            setProgressVisible(false);
            if (!track) {
                setError('Something went wrong!');
            } else if (isEmptyTrack(track) === false) {
                ctx.setCurrentObjectType(OBJECT_TYPE_CLOUD_TRACK);

                track.name = file.name;
                Object.keys(track).forEach((t) => {
                    oneGpxFile[t] = track[t];
                });
                oneGpxFile.analysis = TracksManager.prepareAnalysis(oneGpxFile.analysis);

                ctx.mutateGpxFiles((o) => (o[file.name] = oneGpxFile));
                ctx.setSelectedGpxFile(Object.assign({}, oneGpxFile));

                ctx.setUpdateInfoBlock(true);

                setError('');
            } else {
                setError('Empty track is not supported!');
            }
        }
    }

    useEffect(() => {
        if (ctx.openedPopper && ctx.openedPopper !== anchorEl) {
            setOpenActions(false);
            setShowMenu(false);
        }
    }, [ctx.openedPopper]);

    function setIconStyles() {
        let res = [];
        if (!visible) {
            res.push(styles.icon);
        } else if (ctx.gpxFiles[file.name]?.url && !file.addFromVisibleTracks) {
            res.push(styles.visibleIcon);
        } else {
            res.push(styles.icon);
        }
        return res.join(' ');
    }

    return useMemo(() => {
        const trackName = TracksManager.getFileName(file);
        return (
            <>
                <Tooltip
                    title={visible ? '' : info}
                    arrow
                    placement={mobile ? 'bottom' : 'right'}
                    disableInteractive={visible}
                >
                    <MenuItem
                        className={styles.item}
                        id={'se-cloud-track-' + trackName}
                        onClick={() => setDisplayTrack(true)}
                        onMouseEnter={() => setShowMenu(true)}
                        onMouseLeave={() => {
                            if (!ctx.openedPopper?.current) {
                                setShowMenu(false);
                            }
                        }}
                    >
                        <ListItemIcon className={setIconStyles()}>
                            <TrackIcon />
                        </ListItemIcon>
                        <ListItemText>
                            <MenuItemsTitle name={trackName} maxLines={2} />
                            <Typography variant="body2" className={styles.groupInfo} noWrap>
                                {dist && `${dist} km`}
                                {' · '}
                                {time && `${time}`}
                                {wptPoints && ` · ${wptPoints}`}
                            </Typography>
                        </ListItemText>
                        <Tooltip key={'action_menu_track'} title={'Menu'} arrow placement="bottom-end">
                            <IconButton
                                id={`se-actions-${trackName}`}
                                style={{ display: showMenu ? 'block' : 'none' }}
                                className={styles.sortIcon}
                                onMouseEnter={() => setHoverIconInfo(true)}
                                onMouseLeave={() => setHoverIconInfo(false)}
                                onClick={(e) => {
                                    setOpenActions(true);
                                    ctx.setOpenedPopper(anchorEl);
                                    e.stopPropagation();
                                }}
                                ref={anchorEl}
                            >
                                {hoverIconInfo ? <MenuIconHover /> : <MenuIcon />}
                            </IconButton>
                        </Tooltip>
                        {visible && (
                            <Switch
                                sx={{ ml: '-25px' }}
                                onClick={(e) => e.stopPropagation()}
                                checked={ctx.gpxFiles[file.name]?.url ? !file.addFromVisibleTracks : false}
                                onChange={(e) => !file.local && setDisplayTrack(e.target.checked)}
                            />
                        )}
                    </MenuItem>
                </Tooltip>
                {!isLastItem && <Divider className={styles.dividerItem} />}
                <ActionsMenu
                    open={openActions}
                    setOpen={setOpenActions}
                    anchorEl={anchorEl}
                    setShowMenu={setShowMenu}
                    actions={<TrackActions track={file} setShowTrack={setShowTrack} setOpenActions={setOpenActions} />}
                />
                {loadingTrack ? <LinearProgress /> : <></>}
                {error !== '' && (
                    <Alert onClose={() => setError('')} severity="warning">
                        {error}
                    </Alert>
                )}
            </>
        );
    }, [
        info,
        mobile,
        customIcon,
        file,
        loadingTrack,
        ctx.gpxFiles[file.name]?.url,
        error,
        hoverIconInfo,
        openActions,
        ctx.openedPopper,
        showMenu,
    ]);
}
