#!/bin/bash
export __NV_DISABLE_EXPLICIT_SYNC=1
exec ./amip "$@"
