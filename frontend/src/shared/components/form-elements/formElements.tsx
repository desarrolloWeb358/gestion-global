import React from "react";
import PageBreadcrumb from "../ui/PageBreadCrumb";
import DefaultInputs from "../form-elements/DefaultInputs";
import InputGroup from "../form-elements/InputGroup";
import DropzoneComponent from "../form-elements/DropZone";
import CheckboxComponents from "../form-elements/CheckboxComponents";
import RadioButtons from "../form-elements/RadioButtons";
import ToggleSwitch from "../form-elements/ToggleSwitch";
import FileInputExample from "../form-elements/FileInputExample";
import SelectInputs from "../form-elements/SelectInputs";
import TextAreaInput from "../form-elements/TextAreaInput";
import InputStates from "../form-elements/InputStates";
import PageMeta from "../ui/PageMeta";


export default function FormElements() {
  return (
    <div>
      <PageMeta
        title="React.js Form Elements Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Form Elements  Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="From Elements" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <DefaultInputs />
          <SelectInputs />
          <TextAreaInput />
          <InputStates />
        </div>
        <div className="space-y-6">
          <InputGroup />
          <FileInputExample />
          <CheckboxComponents />
          <RadioButtons />
          <ToggleSwitch />
          <DropzoneComponent />
        </div>
      </div>
    </div>
  );
}
